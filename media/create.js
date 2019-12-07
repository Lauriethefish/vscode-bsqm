/* eslint-env browser */
/* global acquireVsCodeApi */

const vscode = acquireVsCodeApi();
const form = document.querySelector("form");
const browseButton = form.querySelector("#browse button");
const projectFolderInput = form.querySelector("#browse input");
const libil2cppButton = form.querySelector("#libil2cpp button");
const libil2cppInput = form.querySelector("#libil2cpp input");
const ndkbundleButton = form.querySelector("#ndkbundle button");
const ndkbundleInput = form.querySelector("#ndkbundle input");

form.onsubmit = (event) => {
    event.preventDefault();

    const id = form.querySelector("#id input").value;
    const name = form.querySelector("#name input").value;
    const author = form.querySelector("#author input").value;
    const description = form
        .querySelector("#description textarea")
        .value.replace(/\r/g, "")
        .split("\n")
        .filter((line) => line !== "");
    const category = form.querySelector("#category option[selected]").value;
    const gameVersion = form.querySelector("#gameVersion option[selected]")
        .value;
    const libil2cpp = libil2cppInput.value;
    const ndkbundle = ndkbundleInput.value;
    const projectFolder = projectFolderInput.value;

    vscode.postMessage({
        type: "submit",
        payload: {
            id,
            name,
            author,
            description,
            category,
            gameVersion,
            ndkbundle,
            libil2cpp,
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

libil2cppButton.onclick = (event) => {
    event.preventDefault();

    vscode.postMessage({
        type: "libil2cpp",
        payload: {},
    });

    return false;
};

ndkbundleButton.onclick = (event) => {
    event.preventDefault();

    vscode.postMessage({
        type: "ndkbundle",
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

libil2cppInput.onfocus = (event) => {
    event.preventDefault();
    libil2cppInput.blur();
    return false;
};

libil2cppInput.onkeydown = (event) => {
    event.preventDefault();
    libil2cppInput.blur();
    return false;
};

ndkbundleInput.onfocus = (event) => {
    event.preventDefault();
    ndkbundleInput.blur();
    return false;
};

ndkbundleInput.onkeydown = (event) => {
    event.preventDefault();
    ndkbundleInput.blur();
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
    } else if (message.type === "libil2cpp") {
        if (message.payload !== undefined) {
            libil2cppInput.value == message.payload;
        } else {
            libil2cppInput.value = "";
        }
    } else if (message.type === "ndkbundle") {
        if (message.payload !== undefined) {
            ndkbundleInput.value == message.payload;
        } else {
            ndkbundleInput.value = "";
        }
    }
});
