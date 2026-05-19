import { CATALOG } from "@/lib/providers/catalog";

export async function GET() {
  return Response.json({ models: CATALOG });
}
