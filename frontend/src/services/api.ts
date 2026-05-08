import axios from "axios";

/** Ready for `NEXT_PUBLIC_API_URL` when backend is wired */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "",
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});
