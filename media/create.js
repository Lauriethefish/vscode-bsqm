/* eslint-env browser */
/* global acquireVsCodeApi */

const vscode = acquireVsCodeApi();
const form = document.querySelector("form");
const browseButton = form.querySelector("#browse button");
const projectFolderInput = form.querySelector("#browse input");

form.onsubmit = (event) => {
    event.preventDefault();

    const id = form.querySelector("#id input").value;
    const name = form.querySelector("#name input").value;
    const author = form.querySelector("#author input").value;
    const description = form.querySelector("#description textarea").value;
    const projectFolder = projectFolderInput.value;

    vscode.postMessage({
        type: "submit",
        payload: {
            id,
            name,
            author,
            description,
            projectFolder,
        },
    });

    return false;
};

browseButton.onclick = (event) => {
    event.preventDefault();

    vscode.postMessage({
        type: "browse",
        payload: {},
    });

    return false;
};

projectFolderInput.onfocus = (event) => {
    event.preventDefault();
    projectFolderInput.blur();
    return false;
};

projectFolderInput.onkeydown = (event) => {
    event.preventDefault();
    projectFolderInput.blur();
    return false;
};

window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "browse") {
        if (message.payload !== undefined) {
            projectFolderInput.value = message.payload;
        } else {
            projectFolderInput.value = "";
        }
    }
});
