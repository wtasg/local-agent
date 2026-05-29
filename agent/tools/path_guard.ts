import { isAbsolute, normalize, relative, resolve } from "@std/path";

export class PathGuard {
  #root: string;
  #allowedPaths: string[];

  constructor(root: string, allowedPaths: string[]) {
    this.#root = normalize(resolve(root));
    this.#allowedPaths = allowedPaths.length > 0 ? allowedPaths : ["."];
  }

  resolveChecked(targetPath: string): string {
    const absoluteTarget = normalize(
      resolve(this.#root, isAbsolute(targetPath) ? targetPath : targetPath),
    );

    const allowed = this.#allowedPaths.some((allowedPath) => {
      const absoluteAllowed = normalize(resolve(this.#root, allowedPath));
      const rel = relative(absoluteAllowed, absoluteTarget);
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    });

    if (!allowed) {
      throw new Error(`Path is outside allowed scope: ${targetPath}`);
    }

    return absoluteTarget;
  }

  relativeFromRoot(path: string): string {
    const rel = relative(this.#root, path);
    return rel.length > 0 ? rel : ".";
  }
}
