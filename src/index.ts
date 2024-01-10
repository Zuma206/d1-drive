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
		const command = parser.safeParse(await request.json());
		if (!command.success) return err(command.error.issues[0].message, 400);

		const database = env[command.data.database];
		const secret = env[command.data.database + ":SECRET"];

		if (secret !== command.data.secret) return err("Invalid secret", 401);
		if (typeof database !== "object" || !("prepare" in database)) {
			return err("Database not found", 404);
		}

		const statement = database
			.prepare(command.data.query)
			.bind(command.data.params);

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
	},
};
