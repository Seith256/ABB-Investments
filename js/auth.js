// auth.js
export async function authFetch(url, options = {}) {
    const token = sessionStorage.getItem("aab_admin_token") || sessionStorage.getItem("aab_user_token");
    if (!options.headers) options.headers = {};
    if (token) {
        options.headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, options);
}