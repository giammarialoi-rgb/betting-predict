async function main() {
  const res = await fetch("http://localhost:3000/api/permanent-live/status");
  const j = await res.json();
  const ids = (j.next_events || []).map((e) => e.event_id);
  const uniq = new Set(ids);
  console.log(
    JSON.stringify(
      {
        status_ok: res.ok,
        api_calls_ui: j.api_calls_ui,
        next_events: ids.length,
        unique: uniq.size,
        dups: ids.length - uniq.size,
        brain: j.brain_051?.display,
      },
      null,
      2,
    ),
  );
  const id = ids[0];
  if (id) {
    const er = await fetch(`http://localhost:3000/api/permanent-live/event/${id}`);
    console.log(JSON.stringify({ event_detail_status: er.status, id: id.slice(0, 24) }));
  }
  const page = await fetch("http://localhost:3000/actuarial-lab/live-total");
  const html = await page.text();
  console.log(
    JSON.stringify({
      page_status: page.status,
      html_len: html.length,
      has_live: html.includes("LIVE TOTAL") || html.includes("PERMANENT LIVE") || html.includes("Observatory"),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
