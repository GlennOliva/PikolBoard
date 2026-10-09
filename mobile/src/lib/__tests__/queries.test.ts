jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

import { supabase } from "@/lib/supabase";
import { getPlayerLiveBoard } from "@/lib/queries";

const rpc = supabase.rpc as unknown as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

describe("getPlayerLiveBoard", () => {
  it("resolves the public board through the sanitized RPC, never session_standings", async () => {
    rpc.mockResolvedValue({ data: { standings: [] }, error: null });

    await getPlayerLiveBoard("token-1");

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_player_live_board", {
      p_public_token: "token-1",
    });
  });

  it("returns null for an unknown token", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(getPlayerLiveBoard("missing")).resolves.toBeNull();
  });

  it("throws when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nope" } });

    await expect(getPlayerLiveBoard("token-1")).rejects.toThrow("nope");
  });
});
