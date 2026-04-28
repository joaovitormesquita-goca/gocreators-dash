import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractProductName, extractGuidelineNumber } from "./handle-matcher.ts";

Deno.test("extractProductName: extrai nome do produto do ad_name completo", () => {
  const adName =
    "@keycemachado - semana 3 - mes 04 - ano 2026 - com headline overlay - pauta 1245 - produto Linha PH - creator";
  assertEquals(extractProductName(adName), "Linha PH");
});

Deno.test("extractProductName: lida com variações de espaçamento antes do hífen", () => {
  assertEquals(extractProductName("produto Linha Detox - creator"), "Linha Detox");
});

Deno.test("extractProductName: captura produto ao final da string sem hífen", () => {
  assertEquals(extractProductName("- produto Linha PH"), "Linha PH");
});

Deno.test("extractProductName: retorna null quando 'produto' não está presente", () => {
  assertEquals(extractProductName("@creator - pauta 100 - sem info"), null);
});

Deno.test("extractProductName: case insensitive", () => {
  assertEquals(extractProductName("PRODUTO Linha PH - creator"), "Linha PH");
});

Deno.test("extractGuidelineNumber: ainda funciona corretamente após a mudança", () => {
  assertEquals(
    extractGuidelineNumber("pauta 1245 - produto Linha PH"),
    1245,
  );
});
