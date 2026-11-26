"""Пользовательские хендлеры: старт, рефералы, профиль, задания, вывод."""
from __future__ import annotations

import logging
from html import escape
from math import ceil
from urllib.parse import quote

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    ReplyKeyboardMarkup,
)

from bot.config import settings
from bot.database import Database
from bot.keyboards import (
    BTN_BALANCE,
    BTN_PROFILE,
    BTN_TASKS,
    BTN_WITHDRAW,
    MENU_TEXTS,
    TASKS_PER_PAGE,
    main_menu,
    profile_kb,
    task_detail_kb,
    tasks_list_kb,
    withdraw_cancel_kb,
    withdrawal_review_kb,
)
from bot.utils import check_subscription, format_money, parse_money, plural_ru

logger = logging.getLogger(__name__)
router = Router(name="user")

MAX_WITHDRAW = 1_000_000 * 100  # 1 млн ₽ в копейках


class WithdrawForm(StatesGroup):
    amount = State()


def _display_name(user) -> str:
    return escape(user.full_name or user.first_name or str(user.id))


def _is_admin(user_id: int) -> bool:
    return user_id in settings.admin_ids


def _menu(user_id: int) -> ReplyKeyboardMarkup:
    return main_menu(_is_admin(user_id))


async def _edit(callback: CallbackQuery, text: str, reply_markup: InlineKeyboardMarkup | None = None) -> None:
    if not isinstance(callback.message, Message):
        return
    try:
        await callback.message.edit_text(text, reply_markup=reply_markup)
    except TelegramBadRequest:
        logger.debug("Не удалось отредактировать сообщение callback %s", callback.id)


async def _render_tasks(db: Database, user_id: int, page: int):
    tasks = await db.list_active_tasks(user_id)
    if not tasks:
        return None
    total_pages = max(1, ceil(len(tasks) / TASKS_PER_PAGE))
    page = min(max(page, 0), total_pages - 1)
    chunk = tasks[page * TASKS_PER_PAGE : (page + 1) * TASKS_PER_PAGE]

    text = (
        "📋 <b>Доступные задания</b>\n\n"
        "Выберите задание, подпишитесь на канал и нажмите «Проверить подписку».\n"
        "Награда зачисляется автоматически."
    )
    return text, tasks_list_kb(chunk, page, total_pages)


async def _start(
    message: Message,
    payload: str | None,
    state: FSMContext,
    bot: Bot,
    db: Database,
) -> None:
    await state.clear()
    tg_user = message.from_user
    if tg_user is None:
        return

    referrer_id: int | None = None
    notice = ""
    if payload:
        payload = payload.strip()
        if payload.startswith("ref_"):
            raw = payload[4:]
            if raw.isdigit():
                candidate = int(raw)
                if candidate == tg_user.id:
                    notice = "\n\n🙂 Свою же реферальную ссылку использовать нельзя."
                elif await db.get_user(candidate) is None:
                    notice = "\n\n⚠️ Пользователь, пригласивший вас, не найден."
                else:
                    referrer_id = candidate

    is_new = await db.register_user(
        tg_user.id, tg_user.username, tg_user.full_name, referrer_id
    )

    lines = [
        f"👋 <b>Привет, {_display_name(tg_user)}!</b>",
        "",
        "Здесь можно зарабатывать на простых заданиях: подписка на каналы и сообщества.",
        "",
        "💼 Выполняй задания и получай деньги на баланс",
        f"💸 Вывод от {format_money(settings.min_withdraw)}",
    ]
    if settings.referral_reward > 0:
        lines.append(
            f"👥 За каждого друга — {format_money(settings.referral_reward)} "
            "после его первого задания"
        )
    if is_new and referrer_id is not None:
        lines.append("")
        lines.append("🎁 Вы пришли по приглашению — приятной работы!")
    lines.append("")
    lines.append("Выберите раздел в меню ниже 👇")
    if notice:
        lines.append(notice)

    await message.answer("\n".join(lines), reply_markup=_menu(tg_user.id))


@router.message(CommandStart(deep_link=True))
async def cmd_start_deep(
    message: Message,
    command: CommandObject,
    state: FSMContext,
    bot: Bot,
    db: Database,
) -> None:
    await _start(message, command.args, state, bot, db)


@router.message(CommandStart(deep_link=False))
async def cmd_start(
    message: Message,
    state: FSMContext,
    bot: Bot,
    db: Database,
) -> None:
    await _start(message, None, state, bot, db)


@router.message(Command("help"))
async def cmd_help(message: Message, state: FSMContext, db: Database) -> None:
    await state.clear()
    if message.from_user is None:
        return
    bonus_line = (
        f"👥 Бонус за друга: {format_money(settings.referral_reward)} "
        "после его первого задания\n\n"
        if settings.referral_reward > 0
        else ""
    )
    text = (
        "ℹ️ <b>Как это работает</b>\n\n"
        "1. Откройте «📋 Задания».\n"
        "2. Выберите задание и подпишитесь на канал.\n"
        "3. Нажмите «✅ Проверить подписку» — награда сразу придёт на баланс.\n"
        "4. В разделе «💸 Вывод» создайте заявку на вывод средств.\n\n"
        f"💸 Минимальная сумма вывода: {format_money(settings.min_withdraw)}\n"
        f"{bonus_line}"
        "Одно и то же задание засчитывается только один раз."
    )
    await message.answer(text, reply_markup=_menu(message.from_user.id))


@router.message(Command("cancel"))
async def cmd_cancel(message: Message, state: FSMContext) -> None:
    if message.from_user is None:
        return
    current = await state.get_state()
    await state.clear()
    if current is None:
        await message.answer("Нечего отменять 🙂", reply_markup=_menu(message.from_user.id))
    else:
        await message.answer("❌ Действие отменено.", reply_markup=_menu(message.from_user.id))


@router.message(WithdrawForm.amount, F.text, ~F.text.in_(MENU_TEXTS))
async def withdraw_amount(
    message: Message, state: FSMContext, db: Database, bot: Bot
) -> None:
    if message.from_user is None or message.text is None:
        return

    amount = parse_money(message.text)
    if amount is None:
        await message.answer(
            "❌ Не понял сумму. Введите число, например <code>500</code> или <code>150.50</code>.",
            reply_markup=withdraw_cancel_kb(),
        )
        return
    if amount < settings.min_withdraw:
        await message.answer(
            f"❌ Минимальная сумма вывода — {format_money(settings.min_withdraw)}.",
            reply_markup=withdraw_cancel_kb(),
        )
        return
    if amount > MAX_WITHDRAW:
        await message.answer(
            f"❌ Максимальная сумма одной заявки — {format_money(MAX_WITHDRAW)}.",
            reply_markup=withdraw_cancel_kb(),
        )
        return

    result = await db.create_withdrawal(message.from_user.id, amount)
    if result.status == "user_not_found":
        await state.clear()
        await message.answer("Профиль не найден. Отправьте /start.", reply_markup=_menu(message.from_user.id))
        return
    if result.status == "insufficient_balance":
        await state.clear()
        await message.answer(
            f"❌ Недостаточно средств. Ваш баланс: {format_money(result.balance)}.",
            reply_markup=_menu(message.from_user.id),
        )
        return

    await state.clear()
    await message.answer(
        f"✅ <b>Заявка #{result.withdrawal_id} создана</b>\n\n"
        f"💰 Сумма: {format_money(amount)}\n"
        f"💳 Остаток на балансе: {format_money(result.balance)}\n\n"
        "Администратор проверит заявку в ближайшее время.",
        reply_markup=_menu(message.from_user.id),
    )

    admin_text = (
        f"💸 <b>Новая заявка на вывод #{result.withdrawal_id}</b>\n\n"
        f"👤 {_display_name(message.from_user)} "
        f"(<code>{message.from_user.id}</code>)\n"
        f"💰 Сумма: {format_money(amount)}\n"
        f"💳 Остаток у пользователя: {format_money(result.balance)}"
    )
    for admin_id in settings.admin_ids:
        try:
            await bot.send_message(
                admin_id, admin_text, reply_markup=withdrawal_review_kb(result.withdrawal_id)
            )
        except TelegramAPIError:
            logger.warning("Не удалось уведомить администратора %s", admin_id)


async def _show_tasks(message: Message, state: FSMContext, db: Database) -> None:
    if message.from_user is None:
        return
    await state.clear()
    view = await _render_tasks(db, message.from_user.id, 0)
    if view is None:
        await message.answer(
            "Пока нет доступных заданий. Загляните позже! 🙂",
            reply_markup=_menu(message.from_user.id),
        )
        return
    text, keyboard = view
    await message.answer(text, reply_markup=keyboard)


@router.message(Command("tasks"))
async def cmd_tasks(message: Message, state: FSMContext, db: Database) -> None:
    await _show_tasks(message, state, db)


@router.message(F.text == BTN_TASKS)
async def btn_tasks(message: Message, state: FSMContext, db: Database) -> None:
    await _show_tasks(message, state, db)


async def _show_profile(
    message: Message, state: FSMContext, bot: Bot, db: Database
) -> None:
    if message.from_user is None:
        return
    await state.clear()
    user = await db.get_user(message.from_user.id)
    if user is None:
        await _start(message, None, state, bot, db)
        return

    me = await bot.get_me()
    link = f"https://t.me/{me.username}?start=ref_{user['user_id']}"
    referrals = await db.count_referrals(user["user_id"])
    completed = await db.count_completed_tasks(user["user_id"])
    word = plural_ru(referrals, "друг", "друга", "друзей")

    referral_line = (
        "За каждого друга вы получите бонус после его первого задания."
        if settings.referral_reward > 0
        else "Реферальная программа временно отключена."
    )
    text = (
        f"👤 <b>Профиль</b>\n\n"
        f"🆔 ID: <code>{user['user_id']}</code>\n"
        f"💰 Баланс: <b>{format_money(user['balance'])}</b>\n"
        f"📈 Всего заработано: {format_money(user['total_earned'])}\n"
        f"✅ Выполнено заданий: {completed}\n"
        f"👥 Приглашено {word}: {referrals}\n\n"
        f"🔗 Ваша ссылка:\n<code>{link}</code>\n\n"
        f"{referral_line}"
    )
    share_text = quote("Зарабатывай на простых заданиях вместе со мной!")
    share_url = f"https://t.me/share/url?url={quote(link, safe='')}&text={share_text}"
    await message.answer(text, reply_markup=profile_kb(link, share_url))


@router.message(Command("profile"))
async def cmd_profile(message: Message, state: FSMContext, bot: Bot, db: Database) -> None:
    await _show_profile(message, state, bot, db)


@router.message(F.text == BTN_PROFILE)
async def btn_profile(message: Message, state: FSMContext, bot: Bot, db: Database) -> None:
    await _show_profile(message, state, bot, db)


async def _show_balance(message: Message, state: FSMContext, db: Database) -> None:
    if message.from_user is None:
        return
    await state.clear()
    user = await db.get_user(message.from_user.id)
    if user is None:
        await message.answer("Профиль не найден. Отправьте /start.")
        return
    text = (
        f"💰 <b>Баланс</b>\n\n"
        f"Доступно: <b>{format_money(user['balance'])}</b>\n"
        f"Всего заработано: {format_money(user['total_earned'])}\n"
        f"Минимум для вывода: {format_money(settings.min_withdraw)}\n\n"
        "Чтобы вывести средства, нажмите «💸 Вывод»."
    )
    await message.answer(text, reply_markup=_menu(message.from_user.id))


@router.message(Command("balance"))
async def cmd_balance(message: Message, state: FSMContext, db: Database) -> None:
    await _show_balance(message, state, db)


@router.message(F.text == BTN_BALANCE)
async def btn_balance(message: Message, state: FSMContext, db: Database) -> None:
    await _show_balance(message, state, db)


@router.message(F.text == BTN_WITHDRAW)
async def withdraw_start(message: Message, state: FSMContext, db: Database) -> None:
    if message.from_user is None:
        return
    await state.clear()
    user = await db.get_user(message.from_user.id)
    if user is None:
        await message.answer("Профиль не найден. Отправьте /start.")
        return
    if user["balance"] < settings.min_withdraw:
        await message.answer(
            f"💸 Вывод доступен от {format_money(settings.min_withdraw)}.\n"
            f"Сейчас на балансе: {format_money(user['balance'])}.\n\n"
            "Выполните ещё задания, чтобы накопить нужную сумму.",
            reply_markup=_menu(message.from_user.id),
        )
        return

    await state.set_state(WithdrawForm.amount)
    await message.answer(
        f"💸 <b>Вывод средств</b>\n\n"
        f"Доступно: <b>{format_money(user['balance'])}</b>\n"
        f"Минимум: {format_money(settings.min_withdraw)}\n\n"
        "Введите сумму в рублях (например, <code>500</code>).",
        reply_markup=withdraw_cancel_kb(),
    )


# ------------------------------------------------------------------ callbacks
@router.callback_query(F.data == "user:noop")
async def cb_noop(callback: CallbackQuery) -> None:
    await callback.answer()


@router.callback_query(F.data == "user:cancel")
async def cb_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.answer("Отменено")
    await _edit(callback, "❌ Действие отменено.")


@router.callback_query(F.data.startswith("user:tasks:"))
async def cb_tasks(callback: CallbackQuery, db: Database) -> None:
    if callback.from_user is None:
        return
    page = int(callback.data.split(":")[2])
    view = await _render_tasks(db, callback.from_user.id, page)
    if view is None:
        await callback.answer("Заданий пока нет", show_alert=True)
        return
    text, keyboard = view
    await _edit(callback, text, keyboard)
    await callback.answer()


@router.callback_query(F.data.startswith("user:task:"))
async def cb_task_detail(callback: CallbackQuery, db: Database) -> None:
    if callback.from_user is None:
        return
    _, _, raw_id, raw_page = callback.data.split(":")
    task = await db.get_task(int(raw_id))
    if task is None or not task["is_active"]:
        await callback.answer("Задание больше недоступно", show_alert=True)
        return

    completed = await db.is_task_completed(callback.from_user.id, task["id"])
    lines = [f"🎯 <b>{escape(task['title'])}</b>"]
    if task["description"]:
        lines += ["", escape(task["description"])]
    lines += ["", f"💰 Награда: <b>{format_money(task['reward'])}</b>"]
    if completed:
        lines += ["", "✅ Вы уже выполнили это задание."]
    else:
        lines += ["", "Подпишитесь на канал и нажмите «Проверить подписку»."]

    await _edit(
        callback,
        "\n".join(lines),
        task_detail_kb(task["id"], task["channel_link"], int(raw_page), completed=completed),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("user:check:"))
async def cb_check(callback: CallbackQuery, db: Database, bot: Bot) -> None:
    if callback.from_user is None:
        return
    _, _, raw_id, raw_page = callback.data.split(":")
    task_id = int(raw_id)
    page = int(raw_page)

    task = await db.get_task(task_id)
    if task is None or not task["is_active"]:
        await callback.answer("Задание больше недоступно", show_alert=True)
        return

    subscribed, error = await check_subscription(bot, task["channel_id"], callback.from_user.id)
    if not subscribed:
        await callback.answer(error, show_alert=True)
        return

    result = await db.complete_task(callback.from_user.id, task_id)
    if result.status == "already":
        await callback.answer("Вы уже выполняли это задание", show_alert=True)
        return
    if result.status == "missing":
        await callback.answer("Задание или профиль не найдены. Отправьте /start.", show_alert=True)
        return

    user = await db.get_user(callback.from_user.id)
    balance = user["balance"] if user else 0
    text = (
        "✅ <b>Задание выполнено!</b>\n\n"
        f"💰 Начислено: <b>{format_money(result.reward)}</b>\n"
        f"💳 Баланс: {format_money(balance)}"
    )
    if result.referral_bonus:
        text += "\n\n🎁 Вашему пригласившему начислен реферальный бонус."

    await _edit(
        callback,
        text,
        InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="📋 К заданиям", callback_data=f"user:tasks:{page}"
                    )
                ]
            ]
        ),
    )
    await callback.answer("Награда зачислена")

    if result.referrer_id and result.referral_bonus:
        try:
            await bot.send_message(
                result.referrer_id,
                "🎉 <b>Ваш реферал выполнил первое задание!</b>\n\n"
                f"💰 Вам начислен бонус: <b>{format_money(result.referral_bonus)}</b>",
            )
        except TelegramAPIError:
            logger.info("Не удалось уведомить реферера %s", result.referrer_id)


@router.message(F.text)
async def fallback(message: Message) -> None:
    if message.from_user is None:
        return
    await message.answer(
        "Не понял команду 🤔 Воспользуйтесь меню ниже или отправьте /help.",
        reply_markup=_menu(message.from_user.id),
    )
