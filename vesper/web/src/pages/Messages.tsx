import clsx from 'clsx';
import { MessageCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ChatList } from '../components/chat/ChatList';
import { ChatView } from '../components/chat/ChatView';

export function MessagesPage() {
  const { chatId } = useParams();
  return (
    <div className="flex h-full">
      <section className={clsx('h-full w-full shrink-0 border-line/10 md:block md:w-[350px] md:border-r', chatId && 'hidden')} aria-label="Список чатов">
        <ChatList activeId={chatId} />
      </section>
      <section className={clsx('h-full min-w-0 flex-1', !chatId && 'hidden md:block')} aria-label="Переписка">
        {chatId ? (
          <ChatView key={chatId} chatId={chatId} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-raised text-accent">
              <div className="grad absolute inset-0 rounded-[2rem] opacity-20 blur-2xl" />
              <MessageCircle className="relative h-11 w-11" />
            </div>
            <h2 className="font-display text-lg font-semibold">Выберите чат</h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">Откройте переписку слева или создайте новую, чтобы начать общение.</p>
          </div>
        )}
      </section>
    </div>
  );
}
