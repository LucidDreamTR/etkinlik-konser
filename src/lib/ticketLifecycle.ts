export type TicketState =
  | "intent_created"
  | "paid"
  | "minted"
  | "claimable"
  | "claimed"
  | "gate_validated";

export type TicketStateInput = {
  ticketState?: TicketState | null;
  tokenId?: string | null;
  txHash?: string | null;
  claimStatus?: string | null;
  chainClaimed?: boolean | null;
};

export type TransitionMeta<T> = Omit<Partial<T>, "ticketState"> & { updatedAt?: string };

const STATE_ORDER: TicketState[] = [
  "intent_created",
  "paid",
  "minted",
  "claimable",
  "claimed",
  "gate_validated",
];

const STATE_RANK: Record<TicketState, number> = STATE_ORDER.reduce((acc, state, index) => {
  acc[state] = index;
  return acc;
}, {} as Record<TicketState, number>);

const ALLOWED_TRANSITIONS: Record<TicketState, TicketState[]> = {
  intent_created: ["intent_created", "paid", "minted"],
  paid: ["paid", "minted", "claimable"],
  minted: ["minted", "claimable", "claimed"],
  claimable: ["claimable", "claimed"],
  claimed: ["claimed", "gate_validated"],
  gate_validated: ["gate_validated"],
};

export class TicketStateTransitionError extends Error {
  code = "INVALID_TICKET_TRANSITION";
  from: TicketState;
  to: TicketState;

  constructor(from: TicketState, to: TicketState) {
    super(`Invalid ticket state transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
  }
}

export function inferTicketState(order: TicketStateInput): TicketState {
  if (order.ticketState) return order.ticketState;
  const claimed = order.claimStatus === "claimed" || order.chainClaimed === true;
  if (order.tokenId && claimed) return "claimed";
  if (order.tokenId) return "minted";
  if (order.txHash) return "paid";
  return "intent_created";
}

export function ensureTicketState<T extends TicketStateInput>(order: T): T & { ticketState: TicketState } {
  const resolved = inferTicketState(order);
  if (order.ticketState === resolved) {
    return order as T & { ticketState: TicketState };
  }
  return { ...order, ticketState: resolved } as T & { ticketState: TicketState };
}

export function canTransition(from: TicketState, to: TicketState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function setAtLeastState(current: TicketState, desired: TicketState): TicketState {
  return STATE_RANK[current] >= STATE_RANK[desired] ? current : desired;
}

export function applyTransition<T extends TicketStateInput & { updatedAt?: string | null }>(
  order: T,
  to: TicketState,
  meta?: TransitionMeta<T>
): T {
  const { ticketState: from } = ensureTicketState(order);
  if (!canTransition(from, to)) {
    throw new TicketStateTransitionError(from, to);
  }
  const updatedAt = meta?.updatedAt ?? new Date().toISOString();
  return {
    ...order,
    ...meta,
    ticketState: to,
    updatedAt,
  };
}

export function applyAtLeastTransition<T extends TicketStateInput & { updatedAt?: string | null }>(
  order: T,
  desired: TicketState,
  meta?: TransitionMeta<T>
): T {
  const { ticketState: from } = ensureTicketState(order);
  const target = setAtLeastState(from, desired);
  if (target === from) {
    const updatedAt = meta?.updatedAt ?? new Date().toISOString();
    return {
      ...order,
      ...meta,
      ticketState: from,
      updatedAt,
    };
  }
  return applyTransition(order, target, meta);
}
