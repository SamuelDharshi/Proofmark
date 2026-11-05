import { Nav } from "@/components/Nav";
import { ServerDetail } from "@/components/server/ServerDetail";

export default async function Page({ params }: { params: Promise<{ name: string[] }> }) {
  const { name } = await params;
  const server = name.map(decodeURIComponent).join("/");
  return (
    <main>
      <Nav solid />
      <ServerDetail name={server} />
    </main>
  );
}
