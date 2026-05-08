const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

menuToggle.addEventListener("click", () => {
  const isActive = navLinks.classList.toggle("active");
  menuToggle.setAttribute("aria-expanded", String(isActive));
});

const supabaseUrl = "https://nrlkhbgeynmiqesglhgt.supabase.co";
const supabaseKey = "sb_publishable_xoEN2afiedAx0kZBd2022w_KFeCqecX";

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

async function loadChangedTraces() {
  const traceBoard = document.getElementById("traceBoard");

  const { data, error } = await supabaseClient
    .from("NOTE_CHANGED_TRACES")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  console.log(data);

  traceBoard.innerHTML = data
    .map(
      (item) => `
    <article class="trace-item">
      <time class="trace-date">
        ${item.date}
      </time>

      <p class="trace-text">
        ${item.content}
      </p>
    </article>
  `,
    )
    .join("");
}

loadChangedTraces();
