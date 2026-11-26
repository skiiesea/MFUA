"""Асинхронная работа с SQLite (aiosqlite).

Деньги хранятся в копейках (INTEGER). Все изменения баланса выполняются
в явных транзакциях BEGIN IMMEDIATE, а от повторных начислений защищает
уникальный индекс user_tasks(user_id, task_id).
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, NamedTuple

import aiosqlite

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    user_id             INTEGER PRIMARY KEY,
    username            TEXT,
    full_name           TEXT,
    referrer_id         INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    balance             INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    total_earned        INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
    referral_bonus_paid INTEGER NOT NULL DEFAULT 0 CHECK (referral_bonus_paid IN (0, 1)),
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);

CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    channel_id   TEXT NOT NULL,
    channel_link TEXT NOT NULL,
    reward       INTEGER NOT NULL CHECK (reward > 0),
    is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(is_active);

CREATE TABLE IF NOT EXISTS user_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
    reward_paid  INTEGER NOT NULL DEFAULT 0 CHECK (reward_paid >= 0),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at TEXT,
    UNIQUE (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task ON user_tasks(task_id);

CREATE TABLE IF NOT EXISTS withdrawals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount       INTEGER NOT NULL CHECK (amount > 0),
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_id     INTEGER,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
"""

NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"


class CompletionResult(NamedTuple):
    status: Literal["ok", "already", "missing"]
    reward: int = 0
    referral_bonus: int = 0
    referrer_id: int | None = None


class WithdrawalResult(NamedTuple):
    status: Literal["ok", "insufficient_balance", "user_not_found"]
    withdrawal_id: int = 0
    balance: int = 0


class ProcessingResult(NamedTuple):
    status: Literal["ok", "not_found", "already_processed"]
    user_id: int = 0
    amount: int = 0


@dataclass(frozen=True, slots=True)
class Stats:
    users: int
    active_tasks: int
    completed_tasks: int
    total_balance: int
    pending_count: int
    pending_amount: int
    paid_amount: int


class Database:
    def __init__(self, path: str | Path, *, referral_reward: int = 0) -> None:
        self.path = Path(path)
        self.referral_reward = referral_reward
        self._conn: aiosqlite.Connection | None = None
        self._tx_lock = asyncio.Lock()

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("База данных не инициализирована: вызовите connect()")
        return self._conn

    async def connect(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = await aiosqlite.connect(self.path, isolation_level=None)
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.execute("PRAGMA busy_timeout=5000")
        await conn.executescript(SCHEMA)
        self._conn = conn

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[aiosqlite.Connection]:
        """Сериализованная транзакция: BEGIN IMMEDIATE ... COMMIT/ROLLBACK."""
        async with self._tx_lock:
            conn = self.conn
            await conn.execute("BEGIN IMMEDIATE")
            try:
                yield conn
            except BaseException:
                await conn.rollback()
                raise
            else:
                await conn.commit()

    # ------------------------------------------------------------------ users
    async def register_user(
        self,
        user_id: int,
        username: str | None,
        full_name: str,
        referrer_id: int | None = None,
    ) -> bool:
        """Создаёт пользователя. Возвращает True, если он новый.

        Реферера указываем только при создании и только если он существует;
        повторный вход по чужой ссылке привязку не меняет.
        """
        async with self.transaction() as conn:
            cursor = await conn.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,))
            if await cursor.fetchone() is not None:
                await conn.execute(
                    "UPDATE users SET username = ?, full_name = ? WHERE user_id = ?",
                    (username, full_name, user_id),
                )
                return False

            valid_referrer: int | None = None
            if referrer_id is not None and referrer_id != user_id:
                cursor = await conn.execute(
                    "SELECT 1 FROM users WHERE user_id = ?", (referrer_id,)
                )
                if await cursor.fetchone() is not None:
                    valid_referrer = referrer_id

            await conn.execute(
                "INSERT INTO users (user_id, username, full_name, referrer_id) VALUES (?, ?, ?, ?)",
                (user_id, username, full_name, valid_referrer),
            )
            return True

    async def get_user(self, user_id: int) -> aiosqlite.Row | None:
        async with self.conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)) as cur:
            return await cur.fetchone()

    async def count_referrals(self, user_id: int) -> int:
        async with self.conn.execute(
            "SELECT COUNT(*) AS n FROM users WHERE referrer_id = ?", (user_id,)
        ) as cur:
            row = await cur.fetchone()
            return int(row["n"]) if row else 0

    async def count_completed_tasks(self, user_id: int) -> int:
        async with self.conn.execute(
            "SELECT COUNT(*) AS n FROM user_tasks WHERE user_id = ? AND status = 'completed'",
            (user_id,),
        ) as cur:
            row = await cur.fetchone()
            return int(row["n"]) if row else 0

    # ------------------------------------------------------------------ tasks
    async def add_task(
        self,
        *,
        title: str,
        description: str,
        channel_id: str,
        channel_link: str,
        reward: int,
    ) -> int:
        if reward <= 0:
            raise ValueError("Награда должна быть больше нуля")
        async with self.transaction() as conn:
            cursor = await conn.execute(
                "INSERT INTO tasks (title, description, channel_id, channel_link, reward)"
                " VALUES (?, ?, ?, ?, ?)",
                (title, description, channel_id, channel_link, reward),
            )
            return int(cursor.lastrowid)

    async def get_task(self, task_id: int) -> aiosqlite.Row | None:
        async with self.conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)) as cur:
            return await cur.fetchone()

    async def is_task_completed(self, user_id: int, task_id: int) -> bool:
        async with self.conn.execute(
            "SELECT 1 FROM user_tasks WHERE user_id = ? AND task_id = ? AND status = 'completed'",
            (user_id, task_id),
        ) as cur:
            return await cur.fetchone() is not None

    async def list_active_tasks(self, user_id: int | None = None) -> list[aiosqlite.Row]:
        async with self.conn.execute(
            """
            SELECT t.*,
                   CASE WHEN ut.id IS NULL THEN 0 ELSE 1 END AS completed
            FROM tasks t
            LEFT JOIN user_tasks ut
                   ON ut.task_id = t.id AND ut.user_id = ? AND ut.status = 'completed'
            WHERE t.is_active = 1
            ORDER BY t.id
            """,
            (user_id or 0,),
        ) as cur:
            return list(await cur.fetchall())

    async def deactivate_task(self, task_id: int) -> bool:
        """Мягкое удаление: история выполнений и защита от повторной награды сохраняются."""
        async with self.transaction() as conn:
            cursor = await conn.execute(
                "UPDATE tasks SET is_active = 0 WHERE id = ? AND is_active = 1", (task_id,)
            )
            return cursor.rowcount == 1

    async def complete_task(self, user_id: int, task_id: int) -> CompletionResult:
        """Начисляет награду строго один раз за пару (пользователь, задание)."""
        async with self.transaction() as conn:
            cursor = await conn.execute(
                "SELECT id, reward, is_active FROM tasks WHERE id = ?", (task_id,)
            )
            task = await cursor.fetchone()
            if task is None or not task["is_active"]:
                return CompletionResult("missing")

            cursor = await conn.execute(
                "SELECT 1 FROM users WHERE user_id = ?", (user_id,)
            )
            if await cursor.fetchone() is None:
                return CompletionResult("missing")

            cursor = await conn.execute(
                "SELECT 1 FROM user_tasks WHERE user_id = ? AND task_id = ?",
                (user_id, task_id),
            )
            if await cursor.fetchone() is not None:
                return CompletionResult("already", reward=int(task["reward"]))

            # UNIQUE(user_id, task_id) — последняя линия защиты от гонок.
            cursor = await conn.execute(
                "INSERT OR IGNORE INTO user_tasks"
                " (user_id, task_id, status, reward_paid, completed_at)"
                f" VALUES (?, ?, 'completed', ?, {NOW})",
                (user_id, task_id, int(task["reward"])),
            )
            if cursor.rowcount != 1:
                return CompletionResult("already", reward=int(task["reward"]))

            reward = int(task["reward"])
            await conn.execute(
                "UPDATE users SET balance = balance + ?, total_earned = total_earned + ?"
                " WHERE user_id = ?",
                (reward, reward, user_id),
            )

            referral_bonus = 0
            referrer_id: int | None = None
            if self.referral_reward > 0:
                cursor = await conn.execute(
                    "SELECT referrer_id, referral_bonus_paid FROM users WHERE user_id = ?",
                    (user_id,),
                )
                row = await cursor.fetchone()
                if row is not None and row["referrer_id"] and not row["referral_bonus_paid"]:
                    cursor = await conn.execute(
                        "UPDATE users SET referral_bonus_paid = 1"
                        " WHERE user_id = ? AND referral_bonus_paid = 0",
                        (user_id,),
                    )
                    if cursor.rowcount == 1:
                        await conn.execute(
                            "UPDATE users SET balance = balance + ?,"
                            " total_earned = total_earned + ? WHERE user_id = ?",
                            (self.referral_reward, self.referral_reward, row["referrer_id"]),
                        )
                        referrer_id = int(row["referrer_id"])
                        referral_bonus = self.referral_reward

            return CompletionResult(
                "ok", reward=reward, referral_bonus=referral_bonus, referrer_id=referrer_id
            )

    # ------------------------------------------------------------ withdrawals
    async def create_withdrawal(self, user_id: int, amount: int) -> WithdrawalResult:
        """Списывает средства и создаёт заявку в одной транзакции."""
        if amount <= 0:
            raise ValueError("Сумма вывода должна быть больше нуля")
        async with self.transaction() as conn:
            cursor = await conn.execute(
                "SELECT balance FROM users WHERE user_id = ?", (user_id,)
            )
            user = await cursor.fetchone()
            if user is None:
                return WithdrawalResult("user_not_found")

            balance = int(user["balance"])
            if balance < amount:
                return WithdrawalResult("insufficient_balance", balance=balance)

            cursor = await conn.execute(
                "UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?",
                (amount, user_id, amount),
            )
            if cursor.rowcount != 1:
                return WithdrawalResult("insufficient_balance", balance=balance)

            cursor = await conn.execute(
                "INSERT INTO withdrawals (user_id, amount) VALUES (?, ?)", (user_id, amount)
            )
            return WithdrawalResult("ok", withdrawal_id=int(cursor.lastrowid), balance=balance - amount)

    async def get_withdrawal(self, withdrawal_id: int) -> aiosqlite.Row | None:
        async with self.conn.execute(
            """
            SELECT w.*, u.username, u.full_name
            FROM withdrawals w JOIN users u ON u.user_id = w.user_id
            WHERE w.id = ?
            """,
            (withdrawal_id,),
        ) as cur:
            return await cur.fetchone()

    async def list_withdrawals(
        self, status: str = "pending", *, offset: int = 0, limit: int = 10
    ) -> list[aiosqlite.Row]:
        async with self.conn.execute(
            """
            SELECT w.*, u.username, u.full_name
            FROM withdrawals w JOIN users u ON u.user_id = w.user_id
            WHERE w.status = ?
            ORDER BY w.id
            LIMIT ? OFFSET ?
            """,
            (status, limit, offset),
        ) as cur:
            return list(await cur.fetchall())

    async def count_withdrawals(self, status: str = "pending") -> int:
        async with self.conn.execute(
            "SELECT COUNT(*) AS n FROM withdrawals WHERE status = ?", (status,)
        ) as cur:
            row = await cur.fetchone()
            return int(row["n"]) if row else 0

    async def approve_withdrawal(self, withdrawal_id: int, admin_id: int) -> ProcessingResult:
        return await self._process_withdrawal(withdrawal_id, admin_id, approve=True)

    async def reject_withdrawal(self, withdrawal_id: int, admin_id: int) -> ProcessingResult:
        """Отклонение заявки: средства возвращаются на баланс в той же транзакции."""
        return await self._process_withdrawal(withdrawal_id, admin_id, approve=False)

    async def _process_withdrawal(
        self, withdrawal_id: int, admin_id: int, *, approve: bool
    ) -> ProcessingResult:
        new_status = "approved" if approve else "rejected"
        async with self.transaction() as conn:
            cursor = await conn.execute(
                "SELECT user_id, amount, status FROM withdrawals WHERE id = ?",
                (withdrawal_id,),
            )
            row = await cursor.fetchone()
            if row is None:
                return ProcessingResult("not_found")

            user_id = int(row["user_id"])
            amount = int(row["amount"])
            if row["status"] != "pending":
                return ProcessingResult("already_processed", user_id, amount)

            cursor = await conn.execute(
                "UPDATE withdrawals SET status = ?, admin_id = ?,"
                f" processed_at = {NOW} WHERE id = ? AND status = 'pending'",
                (new_status, admin_id, withdrawal_id),
            )
            if cursor.rowcount != 1:
                return ProcessingResult("already_processed", user_id, amount)

            if not approve:
                await conn.execute(
                    "UPDATE users SET balance = balance + ? WHERE user_id = ?",
                    (amount, user_id),
                )
            return ProcessingResult("ok", user_id, amount)

    # ------------------------------------------------------------------ misc
    async def stats(self) -> Stats:
        async def scalar(sql: str) -> int:
            async with self.conn.execute(sql) as cur:
                row = await cur.fetchone()
                return int(row[0]) if row and row[0] is not None else 0

        return Stats(
            users=await scalar("SELECT COUNT(*) FROM users"),
            active_tasks=await scalar("SELECT COUNT(*) FROM tasks WHERE is_active = 1"),
            completed_tasks=await scalar(
                "SELECT COUNT(*) FROM user_tasks WHERE status = 'completed'"
            ),
            total_balance=await scalar("SELECT COALESCE(SUM(balance), 0) FROM users"),
            pending_count=await scalar(
                "SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'"
            ),
            pending_amount=await scalar(
                "SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'pending'"
            ),
            paid_amount=await scalar(
                "SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'approved'"
            ),
        )

    async def all_user_ids(self) -> list[int]:
        async with self.conn.execute("SELECT user_id FROM users ORDER BY user_id") as cur:
            return [int(row["user_id"]) for row in await cur.fetchall()]
