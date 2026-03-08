async function loadDashboard() {
  const res = await fetch("http://localhost:3000/api/attendance/dashboard");

  const data = await res.json();

  const container = document.getElementById("subjects");

  container.innerHTML = "";

  data.forEach((subject) => {
    const card = document.createElement("div");

    card.className = "card";

    card.innerHTML = `
      <h3>${subject.subject}</h3>
      <p>Attendance: ${subject.attendance}</p>
    `;

    container.appendChild(card);
  });
}

loadDashboard();
