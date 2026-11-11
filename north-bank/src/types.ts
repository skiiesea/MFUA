export type Account = { id: number; name: string; number: string; balance: number; color: string; type: string };
export type Transaction = { id: number; title: string; detail: string; amount: number; date: string; category: string; kind: 'income' | 'expense' | 'transfer'; accountId?: number };
export type BankCard = { id: number; accountId: number; name: string; last4: string; network: string; status: 'active' | 'frozen'; type: string };
export type SavingsGoal = { id: number; title: string; target: number; current: number; deadline: string };
export type BankNotification = { id: number; title: string; message: string; date: string; read: boolean };
export type AuditEntry = { id: number; action: string; details: string; date: string };
export type SupportTicket = { id: number; subject: string; message: string; status: string; date: string };
export type Profile = { name: string; customerId: string; theme: 'dark' | 'light'; notificationsEnabled: boolean };
export type BankState = {
  accounts: Account[];
  transactions: Transaction[];
  cards: BankCard[];
  goals: SavingsGoal[];
  notifications: BankNotification[];
  audit: AuditEntry[];
  supportTickets: SupportTicket[];
  profile: Profile;
};
export type AdminSummary = {
  summary: { accounts: number; cards: number; transactions: number; goals: number; openTickets: number; totalDemoBalance: number };
  audit: AuditEntry[];
  tickets: SupportTicket[];
};

export type Page = 'home' | 'accounts' | 'cards' | 'payments' | 'history' | 'analytics' | 'savings' | 'notifications' | 'profile' | 'support' | 'admin';
export type Operation = 'transfer' | 'payment' | 'topup' | 'internal';
