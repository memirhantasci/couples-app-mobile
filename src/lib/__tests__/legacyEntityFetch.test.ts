/// <reference types="jest" />
import { withLegacyEntityDecoding } from "@/lib/legacyEntityFetch";

const REST = "https://proj.supabase.co/rest/v1";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers ?? {}) },
  });
}

function wrap(response: Response) {
  const base = jest.fn(async () => response);
  return { base, fetch: withLegacyEntityDecoding(base as unknown as typeof fetch) };
}

describe("withLegacyEntityDecoding", () => {
  it("PostgREST satırlarındaki eski sanitizeStrict varlıklarını iç içe yapılar dahil çözer", async () => {
    const { fetch } = wrap(
      jsonResponse([
        {
          id: 1,
          title: "Ali&#x27;s &amp; Ayşe",
          location_name: "Kahve &amp;amp; Kitap",
          sender: { display_name: "D&#x27;Angelo" },
          tags: ["&lt;3", 7, null],
        },
      ])
    );
    const res = await fetch(`${REST}/meetings?select=*`);
    expect(await res.json()).toEqual([
      {
        id: 1,
        title: "Ali's & Ayşe",
        location_name: "Kahve & Kitap",
        sender: { display_name: "D'Angelo" },
        tags: ["<3", 7, null],
      },
    ]);
  });

  it("RPC yanıtlarını da çözer (ör. display_name'den türeyen yıldız etiketi, tek değer dönen RPC)", async () => {
    const { fetch } = wrap(jsonResponse({ invitees: [{ label: "D&#x27;Angelo 💕 Ayşe" }], inviter_label: null }));
    const res = await fetch(`${REST}/rpc/get_my_referral_overview`, { method: "POST" });
    expect(await res.json()).toEqual({ invitees: [{ label: "D'Angelo 💕 Ayşe" }], inviter_label: null });

    const scalar = wrap(jsonResponse(JSON.stringify("Ali&#x27;s")));
    expect(await (await scalar.fetch(`${REST}/rpc/some_text`, { method: "POST" })).json()).toBe("Ali's");
  });

  it("durum kodunu ve content-range başlığını (sayım) korur", async () => {
    const { fetch } = wrap(jsonResponse([{ title: "a&amp;b" }], { status: 206, headers: { "content-range": "0-0/42" } }));
    const res = await fetch(`${REST}/memories?select=title`);
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("0-0/42");
    expect(await res.json()).toEqual([{ title: "a&b" }]);
  });

  it("varlık yoksa yanıtı hiç değiştirmeden aynı nesneyle döndürür", async () => {
    const original = jsonResponse([{ title: "Tom & Jerry" }]);
    const { fetch } = wrap(original);
    const res = await fetch(`${REST}/meetings`);
    expect(res).toBe(original);
    expect(await res.json()).toEqual([{ title: "Tom & Jerry" }]);
  });

  it("REST dışındaki istekleri (auth, storage, functions) ve hata yanıtlarını olduğu gibi bırakır", async () => {
    for (const url of [
      "https://proj.supabase.co/auth/v1/token",
      "https://proj.supabase.co/storage/v1/object/list/photos",
      "https://proj.supabase.co/functions/v1/send-push",
    ]) {
      const original = jsonResponse({ msg: "a&amp;b" });
      const { fetch } = wrap(original);
      expect(await fetch(url)).toBe(original);
    }

    const error = jsonResponse({ message: "a&amp;b" }, { status: 400 });
    const { fetch } = wrap(error);
    expect(await fetch(`${REST}/meetings`)).toBe(error);
  });

  it("JSON olmayan gövdelere (csv, boş 204) dokunmaz", async () => {
    const csv = new Response("title\na&amp;b", { status: 200, headers: { "content-type": "text/csv" } });
    expect(await wrap(csv).fetch(`${REST}/meetings`)).toBe(csv);

    const empty = new Response(null, { status: 204 });
    expect(await wrap(empty).fetch(`${REST}/meetings?id=eq.1`, { method: "PATCH" })).toBe(empty);
  });

  it("ayrıştırılamayan JSON'da özgün yanıtı döndürür", async () => {
    const broken = new Response("{bozuk &amp;", { status: 200, headers: { "content-type": "application/json" } });
    const res = await wrap(broken).fetch(`${REST}/meetings`);
    expect(await res.text()).toBe("{bozuk &amp;");
  });

  it("Request nesnesi ve URL nesnesiyle yapılan çağrıları da tanır", async () => {
    const a = wrap(jsonResponse([{ title: "a&amp;b" }]));
    expect(await (await a.fetch(new URL(`${REST}/meetings`))).json()).toEqual([{ title: "a&b" }]);
    const b = wrap(jsonResponse([{ title: "a&amp;b" }]));
    expect(await (await b.fetch(new Request(`${REST}/meetings`))).json()).toEqual([{ title: "a&b" }]);
  });
});
