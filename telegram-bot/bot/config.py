"""Загрузка и валидация настроек из .env.

Денежные значения хранятся в копейках (int), чтобы избежать ошибок
округления чисел с плавающей точкой. В .env суммы задаются в рублях.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


class ConfigError(RuntimeError):
    """Некорректная или неполная конфигурация."""


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ConfigError(
            f"Переменная {name} не задана. Скопируйте .env.example в .env и заполните его."
        )
    return value


def _parse_admins(raw: str) -> frozenset[int]:
    admin_ids: set[int] = set()
    for chunk in raw.replace(";", ",").replace(" ", ",").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            admin_id = int(chunk)
        except ValueError as exc:
            raise ConfigError(f"ADMIN_IDS: '{chunk}' не является числом") from exc
        if admin_id <= 0:
            raise ConfigError(f"ADMIN_IDS: некорректный id {admin_id}")
        admin_ids.add(admin_id)
    if not admin_ids:
        raise ConfigError("ADMIN_IDS: укажите хотя бы одного администратора")
    return frozenset(admin_ids)


def _parse_money(name: str, *, allow_zero: bool) -> int:
    raw = _require(name).replace(" ", "").replace(",", ".")
    try:
        amount = Decimal(raw).quantize(Decimal("0.01"))
    except InvalidOperation as exc:
        raise ConfigError(f"{name}: '{raw}' не является суммой") from exc
    if amount < 0 or (amount == 0 and not allow_zero):
        raise ConfigError(
            f"{name}: сумма должна быть {'неотрицательной' if allow_zero else 'больше нуля'}"
        )
    return int(amount * 100)


@dataclass(frozen=True, slots=True)
class Settings:
    """Настройки приложения. Все суммы — в копейках."""

    bot_token: str
    admin_ids: frozenset[int]
    referral_reward: int
    min_withdraw: int
    db_path: Path

    @classmethod
    def from_env(cls) -> Settings:
        token = _require("BOT_TOKEN")
        if ":" not in token:
            raise ConfigError("BOT_TOKEN не похож на токен Telegram-бота (ожидается '123456:AA...')")

        db_path = Path(os.getenv("DB_PATH", "data/bot.db"))
        if not db_path.is_absolute():
            db_path = BASE_DIR / db_path

        return cls(
            bot_token=token,
            admin_ids=_parse_admins(_require("ADMIN_IDS")),
            referral_reward=_parse_money("REFERRAL_REWARD", allow_zero=True),
            min_withdraw=_parse_money("MIN_WITHDRAW", allow_zero=False),
            db_path=db_path.resolve(),
        )


def load_settings() -> Settings:
    """Явная загрузка настроек (удобно для тестов и скриптов)."""
    return Settings.from_env()


settings = load_settings()
