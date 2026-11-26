"""Вспомогательные функции: деньги, склонения, проверка подписки."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest

ADMIN_STATUSES = frozenset({"administrator", "creator"})
SUBSCRIBED_STATUSES = frozenset({"member", "administrator", "creator"})

BOT_NOT_ADMIN = "Бот не является администратором канала, поэтому проверка подписки невозможна."
CHECK_FAILED = "Не удалось проверить подписку. Попробуйте позже."
NOT_SUBSCRIBED = "Вы ещё не подписаны на канал."


def parse_money(text: str) -> int | None:
    """'1 234,5' -> 123450 копеек. None, если это не положительная сумма."""
    cleaned = text.strip().replace(" ", "").replace("\u00a0", "").replace(",", ".")
    if not cleaned or cleaned.count(".") > 1:
        return None
    try:
        amount = Decimal(cleaned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None
    if amount <= 0:
        return None
    return int(amount * 100)


def format_money(kopecks: int) -> str:
    """123450 -> '1 234,50 ₽'."""
    sign = "−" if kopecks < 0 else ""
    rubles, cents = divmod(abs(int(kopecks)), 100)
    return f"{sign}{rubles:,}".replace(",", " ") + f",{cents:02d} ₽"


def plural_ru(number: int, one: str, few: str, many: str) -> str:
    """Склонение существительного по числу."""
    number = abs(int(number)) % 100
    if 11 <= number <= 19:
        return many
    last = number % 10
    if last == 1:
        return one
    if 2 <= last <= 4:
        return few
    return many


async def check_subscription(bot: Bot, channel_id: str | int, user_id: int) -> tuple[bool, str]:
    """Проверяет подписку пользователя на канал.

    Сначала убеждаемся, что бот действительно администратор канала:
    getChatMember для произвольного участника работает только при наличии прав.
    Возвращает (успех, текст ошибки для пользователя).
    """
    try:
        bot_member = await bot.get_chat_member(channel_id, bot.id)
    except TelegramBadRequest:
        return False, "Канал не найден или бот не добавлен в него."
    except TelegramAPIError:
        return False, CHECK_FAILED

    if bot_member.status not in ADMIN_STATUSES:
        return False, BOT_NOT_ADMIN

    try:
        member = await bot.get_chat_member(channel_id, user_id)
    except TelegramBadRequest:
        return False, "Не удалось получить данные о подписке. Попробуйте позже."
    except TelegramAPIError:
        return False, CHECK_FAILED

    if member.status in SUBSCRIBED_STATUSES:
        return True, ""
    return False, NOT_SUBSCRIBED
