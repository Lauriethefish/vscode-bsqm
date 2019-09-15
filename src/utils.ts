import fetch, { Response } from "node-fetch";
import * as unzipper from "unzipper";

export async function downlaodAndUnzip(url: string, path: string) {
    const res: Response = await fetch(url);
    res.body.pipe(unzipper.Extract({path}));
}
