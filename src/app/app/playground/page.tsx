import { requireSession } from "@/lib/auth";
import { accounts } from "@/lib/data";
import { aiEnabled } from "@/lib/ai/openai";
import { PlaygroundChat } from "./chat";

export default async function Playground() {
  const s = await requireSession();
  const list = await accounts(s.wid);
  return (
    <section className="stage">
      <div className="stage-head">
        <div>
          <h1 className="h2">Playground</h1>
          <p className="lede">Try a comment or DM as a customer. rply runs exactly what it would in production but posts nothing.</p>
        </div>
      </div>
      {!aiEnabled() && <p className="panel panel-pad" role="alert" style={{ borderColor: "var(--tomato)" }}>Add <code>OPENAI_API_KEY</code> to your environment to test AI replies. Instant replies and filters work without it.</p>}
      <PlaygroundChat accounts={list.map((a) => ({ id: a.id, name: a.name, platform: a.platform }))} />
    </section>
  );
}
