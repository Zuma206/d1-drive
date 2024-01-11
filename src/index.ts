import { z } from "zod";

const parser = z.object({
  secret: z.string(),
  database: z.string(),
  query: z.string(),
  params: z.array(z.unknown()).optional(),
  method: z
    .union([
      z.literal("all"),
      z.literal("first"),
      z.literal("raw"),
      z.literal("run"),
    ])
    .optional(),
});

type Env = Record<string, string | D1Database | undefined>;

const err = (err: string, status = 500) => Response.json({ err }, { status });
const res = (res: unknown, status = 200) => Response.json({ res }, { status });

export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST" && request.method !== "GET") {
      return err("Method must be POST", 405);
    } else if (request.method == "GET") {
      return new Response(
        `"Hello, World!" - D1 Drive\n(POST to access the API)`
      );
    }

    const body = await request.json().catch(() => null);
    const command = parser.safeParse(body);
    if (!command.success) {
      const { message, path } = command.error.issues[0];
      const code = path.reduce(
        (accumulator, current) => accumulator + `[${JSON.stringify(current)}]`,
        "body"
      );
      return err(`${code}: ${message}`);
    }

    const database = env[command.data.database];
    const secret = env[command.data.database + ":SECRET"];

    if (typeof database !== "object" || !("prepare" in database)) {
      return err("Database not found", 404);
    }
    if (secret !== command.data.secret) return err("Invalid secret", 401);

    let statement: D1PreparedStatement;
    try {
      statement = database
        .prepare(command.data.query)
        .bind(...(command.data.params ?? []));
    } catch (_) {
      return err("Failed preparing statement", 500);
    }

    try {
      switch (command.data.method) {
        case "all":
          return res(await statement.all());
        case "first":
          return res(await statement.first());
        case "raw":
          return res(await statement.raw());
        default:
          return res(await statement.run());
      }
    } catch (_) {
      return err("Failed executing query", 500);
    }
  },
};
