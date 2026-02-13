import { FrontMatterCache } from "obsidian";
import {
	getGardenPathForNote,
	sanitizePermalink,
	generateUrlPath,
	getRewriteRules,
} from "../utils/utils";
import DigitalGardenSettings from "../models/settings";
import { PathRewriteRules } from "../repositoryConnection/DigitalGardenSiteManager";
import { PublishFile } from "../publishFile/PublishFile";

export type TFrontmatter = Record<string, unknown> & {
	"dg-path"?: string;
	"dg-permalink"?: string;
	"dg-home"?: boolean;
	tags?: string;
};

export type TPublishedFrontMatter = Record<string, unknown> & {
	tags?: string[];
	permalink?: string;
};

export class FrontmatterCompiler {
	private readonly settings: DigitalGardenSettings;
	private readonly rewriteRules: PathRewriteRules;

	constructor(settings: DigitalGardenSettings) {
		this.settings = settings;
		this.rewriteRules = getRewriteRules(settings.pathRewriteRules);
	}

	compile(file: PublishFile, frontmatter: FrontMatterCache): string {
		const fileFrontMatter = { ...frontmatter };
		delete fileFrontMatter["position"];

		let publishedFrontMatter: TPublishedFrontMatter = {
			"pub-blog": true,
		};

		publishedFrontMatter = this.addPublishDate(
			fileFrontMatter,
			publishedFrontMatter,
		);

		publishedFrontMatter = this.addPermalink(
			fileFrontMatter,
			publishedFrontMatter,
			file.getPath(),
		);

		publishedFrontMatter = this.addDefaultPassThrough(
			fileFrontMatter,
			publishedFrontMatter,
		);

		publishedFrontMatter = this.addPageTags(
			fileFrontMatter,
			publishedFrontMatter,
		);

		const fullFrontMatter = publishedFrontMatter;
		const frontMatterString = this.frontMatterToYaml(fullFrontMatter);

		return `---\n${frontMatterString}---\n`;
	}

	private addPublishDate(
		baseFrontMatter: TFrontmatter,
		newFrontMatter: TPublishedFrontMatter,
	) {
		const publishedFrontMatter = { ...newFrontMatter };

		// 如果本地文件有 publishDate 属性，使用它
		if (baseFrontMatter && baseFrontMatter["publishDate"]) {
			publishedFrontMatter["publishDate"] =
				baseFrontMatter["publishDate"];
		}

		return publishedFrontMatter;
	}

	private addPermalink(
		baseFrontMatter: TFrontmatter,
		newFrontMatter: TPublishedFrontMatter,
		filePath: string,
	) {
		const publishedFrontMatter = { ...newFrontMatter };

		const gardenPath =
			baseFrontMatter && baseFrontMatter["dg-path"]
				? baseFrontMatter["dg-path"]
				: getGardenPathForNote(filePath, this.rewriteRules);

		if (gardenPath != filePath) {
			publishedFrontMatter["dg-path"] = gardenPath;
		}

		if (baseFrontMatter && baseFrontMatter["dg-permalink"]) {
			publishedFrontMatter["dg-permalink"] =
				baseFrontMatter["dg-permalink"];

			publishedFrontMatter["permalink"] = sanitizePermalink(
				baseFrontMatter["dg-permalink"],
			);
		} else {
			publishedFrontMatter["permalink"] =
				"/" + generateUrlPath(gardenPath, true);
		}

		return publishedFrontMatter;
	}

	private addDefaultPassThrough(
		baseFrontMatter: TFrontmatter,
		newFrontMatter: TPublishedFrontMatter,
	) {
		const publishedFrontMatter = { ...newFrontMatter };

		if (baseFrontMatter) {
			if (baseFrontMatter["title"]) {
				publishedFrontMatter["title"] = baseFrontMatter["title"];
			}

			if (baseFrontMatter["description"]) {
				publishedFrontMatter["description"] =
					baseFrontMatter["description"];
			}
		}

		return publishedFrontMatter;
	}

	private addPageTags(
		fileFrontMatter: TFrontmatter,
		publishedFrontMatterWithoutTags: TPublishedFrontMatter,
	) {
		const publishedFrontMatter = { ...publishedFrontMatterWithoutTags };

		if (fileFrontMatter) {
			const tags =
				(typeof fileFrontMatter["tags"] === "string"
					? fileFrontMatter["tags"].split(/,\s*/)
					: fileFrontMatter["tags"]) || [];

			if (fileFrontMatter["dg-home"] && !tags.contains("gardenEntry")) {
				tags.push("gardenEntry");
			}

			if (tags.length > 0) {
				publishedFrontMatter["tags"] = tags;
			}
		}

		return publishedFrontMatter;
	}

	/**
	 * 将 frontmatter 对象转换为 YAML 格式字符串
	 */
	private frontMatterToYaml(frontMatter: Record<string, unknown>): string {
		if (Object.keys(frontMatter).length === 0) {
			return "";
		}

		let yaml = "";

		for (const key of Object.keys(frontMatter)) {
			const value = frontMatter[key];
			yaml += this.formatYamlValue(key, value);
		}

		return yaml;
	}

	/**
	 * 格式化 YAML 键值对
	 */
	private formatYamlValue(key: string, value: unknown): string {
		if (value === null || value === undefined) {
			return `${key}: \n`;
		}

		if (typeof value === "boolean") {
			return `${key}: ${value}\n`;
		}

		if (typeof value === "number") {
			return `${key}: ${value}\n`;
		}

		if (typeof value === "string") {
			// 如果字符串包含特殊字符，使用引号包裹
			if (
				value.includes(":") ||
				value.includes("#") ||
				value.includes("{") ||
				value.includes("}") ||
				value.includes("[") ||
				value.includes("]") ||
				value.includes(",") ||
				value.includes("&") ||
				value.includes("*") ||
				value.includes("?") ||
				value.includes("|") ||
				value.includes("-") ||
				value.includes("<") ||
				value.includes(">") ||
				value.includes("=") ||
				value.includes("!") ||
				value.includes("%") ||
				value.includes("@") ||
				value.includes("`") ||
				value.startsWith(" ") ||
				value.endsWith(" ") ||
				value.includes("\n")
			) {
				// 使用双引号并转义特殊字符
				const escaped = value
					.replace(/\\/g, "\\\\")
					.replace(/"/g, '\\"')
					.replace(/\n/g, "\\n");

				return `${key}: "${escaped}"\n`;
			}

			return `${key}: ${value}\n`;
		}

		if (Array.isArray(value)) {
			if (value.length === 0) {
				return `${key}: []\n`;
			}
			let result = `${key}:\n`;

			for (const item of value) {
				if (typeof item === "string") {
					result += `  - ${item}\n`;
				} else {
					result += `  - ${item}\n`;
				}
			}

			return result;
		}

		if (typeof value === "object") {
			// 对于对象类型，使用 JSON 格式作为回退
			return `${key}: ${JSON.stringify(value)}\n`;
		}

		return `${key}: ${value}\n`;
	}
}
