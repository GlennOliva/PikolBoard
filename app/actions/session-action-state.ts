export interface ActionState {
  error: string | null;
  ok: boolean;
  id?: string;
  url?: string;
}

export const idleState: ActionState = {
  error: null,
  ok: false,
};
