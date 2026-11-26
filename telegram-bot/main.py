"""Точка входа Telegram-бота."""
from __future__ import annotations

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, BotCommandScopeDefault

from bot.config import settings
from bot.database import Database
from bot.handlers import admin, user

logger = logging.getLogger(__name__)

COMMANDS = [
    BotCommand(command="start", description="Главное меню"),
    BotCommand(command="tasks", description="Список заданий"),
    BotCommand(command="profile", description="Профиль и реферальная ссылка"),
    BotCommand(command="balance", description="Баланс"),
    BotCommand(command="help", description="Помощь"),
]


async def main() -> None:
    db = Database(settings.db_path, referral_reward=settings.referral_reward)
    await db.connect()

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(admin.router)
    dp.include_router(user.router)

    try:
        me = await bot.get_me()
        logger.info("Бот @%s (id=%s) запущен", me.username, me.id)
        await bot.set_my_commands(COMMANDS, scope=BotCommandScopeDefault())
        await dp.start_polling(
            bot,
            db=db,
            allowed_updates=dp.resolve_used_update_types(),
        )
    finally:
        await db.close()
        await bot.session.close()


def run() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот остановлен")
    except Exception:
        logger.exception("Критическая ошибка, бот остановлен")
        sys.exit(1)


if __name__ == "__main__":
    run()
