"""Админ-панель: задания, заявки на вывод, рассылка."""
from __future__ import annotations

import asyncio
import logging
import re
from html import escape

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest, TelegramRetryAfter
from aiogram.filters import BaseFilter, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message

from bot.config import settings
from bot.database import Database, Stats
from bot.keyboards import (
    BTN_ADMIN,
    WITHDRAWALS_PER_PAGE,
    admin_back_kb,
    admin_menu_kb,
    admin_tasks_kb,
    admin_withdrawals_kb,
    broadcast_confirm_kb,
    cancel_inline_kb,
    withdrawal_review_kb,
)
from bot.utils import ADMIN_STATUSES, format_money, parse_money

logger = logging.getLogger(__name__)
router = Router(name="admin")

MAX_REWARD = 1_000_000 * 100  # 1 млн ₽ в копейках

_CHANNEL_USERNAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{3,31}$")
_CHANNEL_LINK_RE = re.compile(r"^https?://t\.me/(?:[A-Za-z0-9_]{4,32}|\+[A-Za-z0-9_-]{5,})$")


class IsAdmin(BaseFilter):
    async def __call__(self, event: Message | CallbackQuery) -> bool:
        from_user = event.from_user
        return from_user is not None and from_user.id in settings.admin_ids


router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())


class AddTaskForm(StatesGroup):
    title = State()
    description = State()
    channel = State()
    link = State()
    reward = State()


class BroadcastForm(StatesGroup):
    content = State()
    confirm = State()


# ------------------------------------------------------------------- helpers
def _admin_text(stats: Stats) -> str:
    return (
        "⚙️ <b>Админ-панель</b>\n\n"
        f"👥 Пользователей: <b>{stats.users}</b>\n"
        f"🗂 Активных заданий: <b>{stats.active_tasks}</b>\n"
        f"✅ Выполнено заданий: <b>{stats.completed_tasks}</b>\n"
        f"💰 На балансах: <b>{format_money(stats.total_balance)}</b>\n"
        f"💸 Заявок на вывод: <b>{stats.pending_count}</b> "
        f"на {format_money(stats.pending_amount)}\n"
        f"🏦 Выплачено: {format_money(stats.paid_amount)}"
    )


def _parse_channel_ref(raw: str) -> str | int | None:
    value = raw.strip()
    if not value:
        return None
    if "t.me/" in value:
        value = value.split("t.me/", 1)[1].split("?", 1)[0].strip("/")
    value = value.removeprefix("@")
    if value.lstrip("-").isdigit():
        return int(value)
    if not _CHANNEL_USERNAME_RE.fullmatch(value):
        return None
    return f"@{value}"


def _valid_channel_link(link: str) -> bool:
    return bool(_CHANNEL_LINK_RE.fullmatch(link.strip()))


async def _edit(
    callback: CallbackQuery,
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
) -> None:
    if not isinstance(callback.message, Message):
        return
    try:
        await callback.message.edit_text(text, reply_markup=reply_markup)
    except TelegramBadRequest:
        logger.debug("Не удалось отредактировать сообщение callback %s", callback.id)


async def _notify_user(bot: Bot, user_id: int, text: str) -> None:
    try:
        await bot.send_message(user_id, text)
    except TelegramAPIError:
        logger.info("Не удалось отправить уведомление пользователю %s", user_id)


# --------------------------------------------------------------- admin menu
@router.message(Command("admin"))
@router.message(F.text == BTN_ADMIN)
async def admin_menu(message: Message, state: FSMContext, db: Database) -> None:
    await state.clear()
    stats = await db.stats()
    await message.answer(_admin_text(stats), reply_markup=admin_menu_kb())


@router.message(Command("cancel"))
async def admin_cancel(message: Message, state: FSMContext, db: Database) -> None:
    await state.clear()
    stats = await db.stats()
    await message.answer("❌ Действие отменено.\n\n" + _admin_text(stats), reply_markup=admin_menu_kb())


@router.callback_query(F.data == "admin:menu")
async def cb_admin_menu(callback: CallbackQuery, state: FSMContext, db: Database) -> None:
    await state.clear()
    stats = await db.stats()
    await _edit(callback, _admin_text(stats), admin_menu_kb())
    await callback.answer()


@router.callback_query(F.data == "admin:cancel")
async def cb_admin_cancel(callback: CallbackQuery, state: FSMContext, db: Database) -> None:
    await state.clear()
    stats = await db.stats()
    await _edit(callback, "❌ Действие отменено.\n\n" + _admin_text(stats), admin_menu_kb())
    await callback.answer("Отменено")


# --------------------------------------------------------------- add a task
@router.callback_query(F.data == "admin:add")
async def cb_add_task(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(AddTaskForm.title)
    await _edit(
        callback,
        "➕ <b>Новое задание</b>\n\nВведите название задания (3–120 символов):",
        cancel_inline_kb(),
    )
    await callback.answer()


@router.message(AddTaskForm.title, F.text)
async def add_title(message: Message, state: FSMContext) -> None:
    title = message.text.strip()
    if not 3 <= len(title) <= 120:
        await message.answer(
            "Название должно быть от 3 до 120 символов. Попробуйте ещё раз:",
            reply_markup=cancel_inline_kb(),
        )
        return
    await state.update_data(title=title)
    await state.set_state(AddTaskForm.description)
    await message.answer(
        "Введите описание задания (что нужно сделать) или «-», чтобы пропустить:",
        reply_markup=cancel_inline_kb(),
    )


@router.message(AddTaskForm.description, F.text)
async def add_description(message: Message, state: FSMContext) -> None:
    description = message.text.strip()
    if description == "-":
        description = ""
    if len(description) > 900:
        await message.answer(
            "Описание слишком длинное (максимум 900 символов). Сократите:",
            reply_markup=cancel_inline_kb(),
        )
        return
    await state.update_data(description=description)
    await state.set_state(AddTaskForm.channel)
    await message.answer(
        "Отправьте канал: <code>@username</code> или ID вида <code>-1001234567890</code>.\n"
        "Бот должен быть администратором канала.",
        reply_markup=cancel_inline_kb(),
    )


@router.message(AddTaskForm.channel, F.text)
async def add_channel(message: Message, state: FSMContext, bot: Bot) -> None:
    ref = _parse_channel_ref(message.text)
    if ref is None:
        await message.answer(
            "Не понял канал. Отправьте <code>@username</code> или ID вида "
            "<code>-1001234567890</code>.",
            reply_markup=cancel_inline_kb(),
        )
        return

    try:
        chat = await bot.get_chat(ref)
    except TelegramAPIError:
        await message.answer(
            "Не удалось открыть канал. Проверьте @username/ID и добавьте бота в канал.",
            reply_markup=cancel_inline_kb(),
        )
        return

    if chat.type != "channel":
        await message.answer(
            "Это не канал. Задание можно привязать только к каналу.",
            reply_markup=cancel_inline_kb(),
        )
        return

    try:
        bot_member = await bot.get_chat_member(chat.id, bot.id)
    except TelegramAPIError:
        await message.answer(
            "Не удалось проверить права бота в канале. Убедитесь, что бот добавлен "
            "в администраторы.",
            reply_markup=cancel_inline_kb(),
        )
        return

    if bot_member.status not in ADMIN_STATUSES:
        await message.answer(
            "❌ Бот не администратор этого канала. Добавьте бота в администраторы "
            "(с правом просмотра участников) и отправьте канал ещё раз.",
            reply_markup=cancel_inline_kb(),
        )
        return

    auto_link = f"https://t.me/{chat.username}" if chat.username else None
    await state.update_data(
        channel_id=str(chat.id),
        channel_title=chat.title,
        auto_link=auto_link,
        channel_link=auto_link,
    )

    if auto_link:
        await state.set_state(AddTaskForm.reward)
        await message.answer(
            f"Канал «{escape(chat.title)}» сохранён.\n\n"
            "Введите награду за задание в рублях (например, <code>15</code>):",
            reply_markup=cancel_inline_kb(),
        )
        return

    await state.set_state(AddTaskForm.link)
    await message.answer(
        "Канал приватный, поэтому нужна ссылка-приглашение.\n"
        "Отправьте ссылку вида <code>https://t.me/+AbCdEf123</code>:",
        reply_markup=cancel_inline_kb(),
    )


@router.message(AddTaskForm.link, F.text)
async def add_link(message: Message, state: FSMContext) -> None:
    link = message.text.strip()
    if link == "-":
        data = await state.get_data()
        link = data.get("auto_link") or ""
        if not link:
            await message.answer(
                "Для приватного канала ссылку нужно указать вручную.",
                reply_markup=cancel_inline_kb(),
            )
            return
    if not _valid_channel_link(link):
        await message.answer(
            "Ссылка должна начинаться с <code>https://t.me/</code>. Попробуйте ещё раз:",
            reply_markup=cancel_inline_kb(),
        )
        return

    await state.update_data(channel_link=link)
    await state.set_state(AddTaskForm.reward)
    await message.answer(
        "Введите награду за задание в рублях (например, <code>15</code>):",
        reply_markup=cancel_inline_kb(),
    )


@router.message(AddTaskForm.reward, F.text)
async def add_reward(message: Message, state: FSMContext, db: Database) -> None:
    reward = parse_money(message.text)
    if reward is None or reward < 100:
        await message.answer(
            "Награда должна быть больше нуля (минимум 1 ₽). Например: <code>15</code>.",
            reply_markup=cancel_inline_kb(),
        )
        return
    if reward > MAX_REWARD:
        await message.answer(
            f"Слишком большая награда. Максимум: {format_money(MAX_REWARD)}.",
            reply_markup=cancel_inline_kb(),
        )
        return

    data = await state.get_data()
    if not data.get("channel_link") or not data.get("channel_id"):
        await state.clear()
        await message.answer(
            "Что-то пошло не так, начните добавление заново.",
            reply_markup=admin_menu_kb(),
        )
        return

    task_id = await db.add_task(
        title=data["title"],
        description=data.get("description", ""),
        channel_id=data["channel_id"],
        channel_link=data["channel_link"],
        reward=reward,
    )
    await state.clear()
    await message.answer(
        f"✅ <b>Задание #{task_id} добавлено</b>\n\n"
        f"📌 {escape(data['title'])}\n"
        f"📢 {escape(data.get('channel_title') or data['channel_id'])}\n"
        f"💰 {format_money(reward)}",
        reply_markup=admin_menu_kb(),
    )


# ----------------------------------------------------------- delete a task
@router.callback_query(F.data == "admin:del")
async def cb_task_list(callback: CallbackQuery, db: Database) -> None:
    tasks = await db.list_active_tasks()
    if not tasks:
        await callback.answer("Активных заданий нет", show_alert=True)
        return
    await _edit(
        callback,
        "🗂 <b>Активные задания</b>\n\nНажмите на задание, чтобы снять его с публикации. "
        "История выполнений сохранится.",
        admin_tasks_kb(tasks),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:del:"))
async def cb_delete_task(callback: CallbackQuery, db: Database) -> None:
    task_id = int(callback.data.split(":")[2])
    task = await db.get_task(task_id)
    if task is None:
        await callback.answer("Задание не найдено", show_alert=True)
        return

    removed = await db.deactivate_task(task_id)
    if not removed:
        await callback.answer("Задание уже снято", show_alert=True)
        return

    tasks = await db.list_active_tasks()
    if not tasks:
        await _edit(
            callback,
            "✅ Задание снято с публикации.\n\nБольше активных заданий нет.",
            admin_back_kb(),
        )
    else:
        await _edit(
            callback,
            "✅ Задание снято с публикации.\n\n🗂 <b>Активные задания</b>",
            admin_tasks_kb(tasks),
        )
    await callback.answer("Готово")


# -------------------------------------------------------------- withdrawals
@router.callback_query(F.data.startswith("admin:withdrawals:"))
async def cb_withdrawals(callback: CallbackQuery, db: Database) -> None:
    offset = int(callback.data.split(":")[2])
    total = await db.count_withdrawals("pending")
    if total == 0:
        await _edit(callback, "💸 Заявок на вывод пока нет.", admin_back_kb())
        await callback.answer()
        return

    if offset >= total:
        offset = ((total - 1) // WITHDRAWALS_PER_PAGE) * WITHDRAWALS_PER_PAGE

    rows = await db.list_withdrawals("pending", offset=offset, limit=WITHDRAWALS_PER_PAGE)
    await _edit(
        callback,
        f"💸 <b>Заявки на вывод</b> — {total} шт.\n\n"
        "Нажмите на заявку, чтобы рассмотреть её.",
        admin_withdrawals_kb(rows, offset, total),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:wv:"))
async def cb_withdrawal_view(callback: CallbackQuery, db: Database) -> None:
    withdrawal_id = int(callback.data.split(":")[2])
    row = await db.get_withdrawal(withdrawal_id)
    if row is None:
        await callback.answer("Заявка не найдена", show_alert=True)
        return
    if row["status"] != "pending":
        await callback.answer("Заявка уже обработана", show_alert=True)
        return

    name = f"@{row['username']}" if row["username"] else escape(row["full_name"] or "")
    text = (
        f"💸 <b>Заявка #{row['id']}</b>\n\n"
        f"👤 {name} (<code>{row['user_id']}</code>)\n"
        f"💰 Сумма: <b>{format_money(row['amount'])}</b>\n"
        f"📅 Создана: {row['created_at']}\n\n"
        "⚠️ Деньги уже списаны с баланса пользователя.\n"
        "«Одобрить» — выплата подтверждена, «Отклонить» — средства вернутся на баланс."
    )
    await _edit(callback, text, withdrawal_review_kb(withdrawal_id))
    await callback.answer()


@router.callback_query(F.data.startswith("admin:wa:"))
async def cb_approve_withdrawal(callback: CallbackQuery, db: Database, bot: Bot) -> None:
    withdrawal_id = int(callback.data.split(":")[2])
    result = await db.approve_withdrawal(withdrawal_id, callback.from_user.id)
    if result.status == "not_found":
        await callback.answer("Заявка не найдена", show_alert=True)
        return
    if result.status == "already_processed":
        await callback.answer("Заявка уже обработана", show_alert=True)
        return

    await _edit(
        callback,
        f"✅ Заявка #{withdrawal_id} одобрена.\n\n"
        f"👤 <code>{result.user_id}</code>\n"
        f"💰 {format_money(result.amount)}",
        admin_back_kb(),
    )
    await _notify_user(
        bot,
        result.user_id,
        f"✅ Заявка на вывод #{withdrawal_id} одобрена.\n"
        f"💰 Сумма: {format_money(result.amount)}\n\n"
        "Выплата будет произведена в ближайшее время.",
    )
    await callback.answer("Выплата подтверждена")


@router.callback_query(F.data.startswith("admin:wr:"))
async def cb_reject_withdrawal(callback: CallbackQuery, db: Database, bot: Bot) -> None:
    withdrawal_id = int(callback.data.split(":")[2])
    result = await db.reject_withdrawal(withdrawal_id, callback.from_user.id)
    if result.status == "not_found":
        await callback.answer("Заявка не найдена", show_alert=True)
        return
    if result.status == "already_processed":
        await callback.answer("Заявка уже обработана", show_alert=True)
        return

    await _edit(
        callback,
        f"❌ Заявка #{withdrawal_id} отклонена.\n\n"
        f"👤 <code>{result.user_id}</code>\n"
        f"💰 {format_money(result.amount)} возвращено на баланс.",
        admin_back_kb(),
    )
    await _notify_user(
        bot,
        result.user_id,
        f"❌ Заявка на вывод #{withdrawal_id} отклонена.\n"
        f"💰 {format_money(result.amount)} возвращено на ваш баланс.",
    )
    await callback.answer("Заявка отклонена")


# ------------------------------------------------------------------- stats
@router.callback_query(F.data == "admin:stats")
async def cb_stats(callback: CallbackQuery, db: Database) -> None:
    stats = await db.stats()
    await _edit(callback, _admin_text(stats), admin_back_kb())
    await callback.answer()


# --------------------------------------------------------------- broadcast
@router.callback_query(F.data == "admin:bc")
async def cb_broadcast(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(BroadcastForm.content)
    await _edit(
        callback,
        "📢 <b>Рассылка</b>\n\nОтправьте сообщение, которое нужно разослать всем "
        "пользователям (текст, фото, видео и т.п.).",
        cancel_inline_kb(),
    )
    await callback.answer()


@router.message(BroadcastForm.content)
async def broadcast_content(message: Message, state: FSMContext, db: Database) -> None:
    if message.text and message.text.startswith("/"):
        await state.clear()
        await message.answer(
            "❌ Рассылка отменена: команды не рассылаются.",
            reply_markup=admin_menu_kb(),
        )
        return
    await state.update_data(
        src_chat=message.chat.id, src_message=message.message_id
    )
    await state.set_state(BroadcastForm.confirm)
    total = len(await db.all_user_ids())
    await message.answer(
        f"📢 Отправить это сообщение <b>{total}</b> пользователям?",
        reply_markup=broadcast_confirm_kb(),
    )


@router.callback_query(F.data == "admin:bc:cancel")
async def cb_broadcast_cancel(callback: CallbackQuery, state: FSMContext, db: Database) -> None:
    await state.clear()
    stats = await db.stats()
    await _edit(callback, "❌ Рассылка отменена.\n\n" + _admin_text(stats), admin_menu_kb())
    await callback.answer("Отменено")


@router.callback_query(F.data == "admin:bc:go")
async def cb_broadcast_go(callback: CallbackQuery, state: FSMContext, db: Database, bot: Bot) -> None:
    data = await state.get_data()
    src_chat = data.get("src_chat")
    src_message = data.get("src_message")
    await state.clear()
    if not src_chat or not src_message:
        await callback.answer("Сообщение для рассылки не найдено", show_alert=True)
        return
    if not isinstance(callback.message, Message):
        await callback.answer()
        return

    await callback.answer("Рассылка запущена")
    user_ids = await db.all_user_ids()
    status = await callback.message.answer(f"⏳ Рассылка: 0/{len(user_ids)}")

    sent = 0
    failed = 0
    for index, user_id in enumerate(user_ids, start=1):
        delivered = False
        try:
            await bot.copy_message(
                chat_id=user_id, from_chat_id=src_chat, message_id=src_message
            )
            delivered = True
        except TelegramRetryAfter as exc:
            await asyncio.sleep(exc.retry_after + 1)
            try:
                await bot.copy_message(
                    chat_id=user_id, from_chat_id=src_chat, message_id=src_message
                )
                delivered = True
            except TelegramAPIError:
                delivered = False
        except TelegramAPIError:
            delivered = False

        if delivered:
            sent += 1
        else:
            failed += 1

        if index % 25 == 0 or index == len(user_ids):
            try:
                await status.edit_text(f"⏳ Рассылка: {index}/{len(user_ids)}")
            except TelegramAPIError:
                pass
        await asyncio.sleep(0.05)

    await status.edit_text(
        "✅ <b>Рассылка завершена</b>\n\n"
        f"📬 Отправлено: {sent}\n"
        f"🚫 Не доставлено: {failed}",
        reply_markup=admin_back_kb(),
    )
