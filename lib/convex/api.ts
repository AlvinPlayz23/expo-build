// Function references for calling Convex.
//
// We use `anyApi` (path-based, untyped references) so the whole project
// compiles and runs BEFORE `npx convex dev` generates `convex/_generated`.
// `api.projects.list` resolves to the Convex function "projects:list".
//
// Once you've run `npx convex dev`, you can swap this for the typed version:
//   export { api } from "@/convex/_generated/api";
import { anyApi } from "convex/server";

export const api = anyApi;
