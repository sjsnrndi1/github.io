const supabaseUrl = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const supabaseKey = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener("DOMContentLoaded", loadChangedTraces);

async function loadChangedTraces() {
  const traceBoard = document.getElementById("traceBoard");
  if (!traceBoard) return;

  const { data, error } = await supabaseClient
    .from("NOTE_CHANGED_TRACES")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const groupedByYear = data.reduce((acc, item) => {
    const rawDate = String(item.date);
    const year = rawDate.slice(0, 4);

    if (!acc[year]) acc[year] = [];
    acc[year].push(item);

    return acc;
  }, {});

  traceBoard.innerHTML = Object.entries(groupedByYear)
    .map(([year, items]) => {
      return `
      <section class="timeline-year" aria-labelledby="year-${year}">
        <h2 class="year-label" id="year-${year}">${year}</h2>

        <div class="trace-list">
          ${items
            .map((item) => {
              const rawDate = String(item.date);
              const isHyphenDate = rawDate.includes("-");
              const itemYear = rawDate.slice(0, 4);
              const month = isHyphenDate ? rawDate.slice(5, 7) : rawDate.slice(4, 6);
              const day = isHyphenDate ? rawDate.slice(8, 10) : rawDate.slice(6, 8);

              return `
                <article class="trace-item">
                  <time class="trace-date" datetime="${itemYear}-${month}-${day}">
                    ${month}.${day}
                  </time>

                  <p class="trace-text">
                    ${item.content}
                  </p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
    })
    .join("");
}
