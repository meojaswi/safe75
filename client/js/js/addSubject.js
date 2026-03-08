async function addSubject() {
  const name = document.getElementById("name").value;
  const type = document.getElementById("type").value;
  const daysInput = document.getElementById("days").value;

  const days = daysInput.split(",");

  const res = await fetch("http://localhost:3000/api/subjects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      type,
      days,
    }),
  });

  const data = await res.json();

  document.getElementById("message").innerText = data.message;
}
