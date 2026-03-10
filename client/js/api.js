const API_BASE = "";

async function apiRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(API_BASE + path, options);

  if (res.status === 401) {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userName");
    window.location.href = "login.html";
    throw new Error("Session expired");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || "Something went wrong");
  }

  return data;
}

const api = {
  get: (path) => apiRequest("GET", path),
  post: (path, body) => apiRequest("POST", path, body),
  put: (path, body) => apiRequest("PUT", path, body),
  delete: (path) => apiRequest("DELETE", path),
};
