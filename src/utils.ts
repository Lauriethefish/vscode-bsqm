import { promises as fs } from "fs";
import fetch, { Response } from "node-fetch";
import * as unzipper from "unzipper";

export async function downlaodAndUnzip(url: string, path: string) {
    const res: Response = await fetch(url);
    res.body.pipe(unzipper.Extract({path}));
}

export async function directoryIsEmpty(path: string): Promise<boolean> {
    const contents: string[] = await fs.readdir(path);
    return contents.length === 0;
}
