/// <reference types="jest" />
import { supabase } from "@/lib/supabase";
import { joinCoupleByCode } from "../joinCouple";

jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as unknown as jest.Mock;

describe("joinCoupleByCode", () => {
  beforeEach(() => rpc.mockReset());

  it("başarılı katılımı isPaired ile döndürür", async () => {
    rpc.mockResolvedValue({ data: [{ result_couple_id: 7, result_is_paired: true, result_error: null }], error: null });
    await expect(joinCoupleByCode("ABC123")).resolves.toEqual({ data: { isPaired: true }, error: null });
  });

  it("sunucunun result_error alanını hata olarak sunar (geçersiz kod, deneme sınırı)", async () => {
    rpc.mockResolvedValue({ data: [{ result_couple_id: null, result_is_paired: false, result_error: "TOO_MANY_REQUESTS" }], error: null });
    await expect(joinCoupleByCode("ABC123")).resolves.toEqual({ data: null, error: { message: "TOO_MANY_REQUESTS" } });
  });

  it("fırlatılan RPC hatasını olduğu gibi iletir", async () => {
    const error = { message: "ALREADY_PAIRED" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(joinCoupleByCode("ABC123")).resolves.toEqual({ data: null, error });
  });
});
