import { json, getUser } from "../../_shared.js";
export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  return json({ user });
}
