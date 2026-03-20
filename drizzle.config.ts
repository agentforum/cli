import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/store/schema.ts",
  out: "./src/store/migrations",
  dbCredentials: {
    url: "./.forum/db.sqlite",
  },
});
