const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const pagesDirectory = path.join(__dirname, "pages");

/**
 * Loads locale YAML files from a route-local locale directory.
 */
function loadLocales(directory) {
  return fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".yml"))
    .sort()
    .map((fileName) => {
      const code = path.basename(fileName, ".yml");
      const filePath = path.join(directory, fileName);

      return {
        code,
        translations: yaml.load(fs.readFileSync(filePath, "utf8")),
      };
    });
}

/**
 * Finds page templates that have a sibling locale directory.
 */
function findLocalizedRoutes(directory) {
  const routes = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory() && entry.name !== "locale") {
      routes.push(...findLocalizedRoutes(entryPath));
    }
  }

  const templatePath = path.join(directory, "index.pug");
  const localeDirectory = path.join(directory, "locale");

  if (fs.existsSync(templatePath) && fs.existsSync(localeDirectory)) {
    routes.push({
      inputPath: path.relative(pagesDirectory, templatePath),
      templatePath,
      localeDirectory,
      routePath: path.relative(pagesDirectory, directory),
    });
  }

  return routes;
}

module.exports = async function (eleventyConfig) {
  const { default: eleventyPug } = await import("@11ty/eleventy-plugin-pug");
  const { imageTransformPlugin } = await import("@11ty/eleventy-img");

  // add pug plugin
  eleventyConfig.addPlugin(eleventyPug);

  // add image transform plugin, and configs
  eleventyConfig.addPlugin(imageTransformPlugin, {
    widths: [400, 800],
    formats: ["webp", "jpeg"],
    outputDir: path.join(__dirname, "dist", "img"),
    urlPath: "/img/",
  });
  eleventyConfig.addPassthroughCopy("public");
  
  const localizedRoutes = findLocalizedRoutes(pagesDirectory);

  for (const route of localizedRoutes) {
    eleventyConfig.ignores.add(path.join("pages", route.inputPath));
    eleventyConfig.addTemplate(
      route.inputPath,
      fs.readFileSync(route.templatePath, "utf8"),
      {
        locales: loadLocales(route.localeDirectory),
        pagination: {
          data: "locales",
          size: 1,
          alias: "locale",
        },
        eleventyComputed: {
          permalink: (data) => {
            const routePrefix = route.routePath
              ? `${route.routePath.replaceAll(path.sep, "/")}/`
              : "";

            return `${data.locale.code}/${routePrefix}index.html`;
          },
        },
      },
    );
  }

  return {
    dir: {
      input: "pages",
      output: "dist",
    },
    templateFormats: ["pug"],
  };
};
