"""Inline- и reply-клавиатуры бота."""
from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

from bot.utils import format_money

BTN_TASKS = "📋 Задания"
BTN_PROFILE = "👤 Профиль"
BTN_BALANCE = "💰 Баланс"
BTN_WITHDRAW = "💸 Вывод"
BTN_ADMIN = "⚙️ Админ-панель"

MENU_TEXTS = (BTN_TASKS, BTN_PROFILE, BTN_BALANCE, BTN_WITHDRAW, BTN_ADMIN)

TASKS_PER_PAGE = 8
WITHDRAWALS_PER_PAGE = 5


def main_menu(is_admin: bool = False) -> ReplyKeyboardMarkup:
    builder = ReplyKeyboardBuilder()
    builder.row(
        KeyboardButton(text=BTN_TASKS),
        KeyboardButton(text=BTN_PROFILE),
    )
    builder.row(
        KeyboardButton(text=BTN_BALANCE),
        KeyboardButton(text=BTN_WITHDRAW),
    )
    if is_admin:
        builder.row(KeyboardButton(text=BTN_ADMIN))
    return builder.as_markup(resize_keyboard=True, input_field_placeholder="Выберите действие")


def remove_kb() -> ReplyKeyboardRemove:
    return ReplyKeyboardRemove()


def profile_kb(referral_link: str, share_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="👥 Поделиться ссылкой", url=share_url)],
            [InlineKeyboardButton(text="📋 Задания", callback_data="user:tasks:0")],
        ]
    )


def _short(text: str, limit: int = 30) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def tasks_list_kb(tasks: Sequence[Any], page: int, total_pages: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for task in tasks:
        mark = "✅" if task["completed"] else "▶️"
        builder.button(
            text=f"{mark} {_short(task['title'])} · {format_money(int(task['reward']))}",
            callback_data=f"user:task:{int(task['id'])}:{page}",
        )
    builder.adjust(1)

    navigation: list[InlineKeyboardButton] = []
    if page > 0:
        navigation.append(
            InlineKeyboardButton(text="⬅️ Назад", callback_data=f"user:tasks:{page - 1}")
        )
    navigation.append(
        InlineKeyboardButton(text=f"{page + 1}/{total_pages}", callback_data="user:noop")
    )
    if page + 1 < total_pages:
        navigation.append(
            InlineKeyboardButton(text="Вперёд ➡️", callback_data=f"user:tasks:{page + 1}")
        )
    if navigation:
        builder.row(*navigation)
    return builder.as_markup()


def task_detail_kb(
    task_id: int, channel_link: str, page: int, *, completed: bool = False
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton(text="🔗 Перейти в канал", url=channel_link)]
    ]
    if not completed:
        rows.append(
            [
                InlineKeyboardButton(
                    text="✅ Проверить подписку",
                    callback_data=f"user:check:{task_id}:{page}",
                )
            ]
        )
    rows.append(
        [InlineKeyboardButton(text="⬅️ К заданиям", callback_data=f"user:tasks:{page}")]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def withdraw_cancel_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="❌ Отмена", callback_data="user:cancel")]]
    )


# --------------------------------------------------------------------- admin
def admin_menu_kb() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="➕ Добавить задание", callback_data="admin:add")
    builder.button(text="🗂 Активные задания", callback_data="admin:del")
    builder.button(text="💸 Заявки на вывод", callback_data="admin:withdrawals:0")
    builder.button(text="📢 Рассылка", callback_data="admin:bc")
    builder.button(text="📊 Статистика", callback_data="admin:stats")
    builder.adjust(1)
    return builder.as_markup()


def admin_back_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="⬅️ В админ-панель", callback_data="admin:menu")]]
    )


def cancel_inline_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="❌ Отмена", callback_data="admin:cancel")]]
    )


def admin_tasks_kb(tasks: Sequence[Any]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for task in tasks:
        builder.button(
            text=f"❌ {_short(task['title'], 24)} · {format_money(int(task['reward']))}",
            callback_data=f"admin:del:{int(task['id'])}",
        )
    builder.button(text="⬅️ В админ-панель", callback_data="admin:menu")
    builder.adjust(1)
    return builder.as_markup()


def admin_withdrawals_kb(
    withdrawals: Sequence[Any], offset: int, total: int
) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for row in withdrawals:
        name = f"@{row['username']}" if row["username"] else f"id{row['user_id']}"
        builder.button(
            text=f"#{row['id']} · {_short(name, 18)} · {format_money(int(row['amount']))}",
            callback_data=f"admin:wv:{int(row['id'])}",
        )
    navigation: list[InlineKeyboardButton] = []
    if offset > 0:
        prev_offset = max(0, offset - WITHDRAWALS_PER_PAGE)
        navigation.append(
            InlineKeyboardButton(
                text="⬅️", callback_data=f"admin:withdrawals:{prev_offset}"
            )
        )
    if offset + WITHDRAWALS_PER_PAGE < total:
        navigation.append(
            InlineKeyboardButton(
                text="➡️",
                callback_data=f"admin:withdrawals:{offset + WITHDRAWALS_PER_PAGE}",
            )
        )
    if navigation:
        builder.row(*navigation)
    builder.row(InlineKeyboardButton(text="⬅️ В админ-панель", callback_data="admin:menu"))
    builder.adjust(1)
    return builder.as_markup()


def withdrawal_review_kb(withdrawal_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Одобрить", callback_data=f"admin:wa:{withdrawal_id}"
                ),
                InlineKeyboardButton(
                    text="❌ Отклонить", callback_data=f"admin:wr:{withdrawal_id}"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="⬅️ К заявкам", callback_data="admin:withdrawals:0"
                )
            ],
        ]
    )


def broadcast_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🚀 Отправить", callback_data="admin:bc:go"),
                InlineKeyboardButton(text="❌ Отмена", callback_data="admin:bc:cancel"),
            ]
        ]
    )
