#!/usr/bin/env node
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import inquirer from "inquirer";
// import os from "os";

const exec = promisify(execCb);
const executeShellCommand = async (command = "", verifyUserCommand = false) => {
  try {
    if (!command || command == "") {
      return null;
    }

    const res = await exec(command);
    return res;
  } catch (e) {
    if (!verifyUserCommand) {
      // console.error(e);
      return null;
    }

    /*IF THIS COMMAND IS A VERIFY COMMAND, ERROR WILL BE THROWN BUT IS EXPECTED */
    let res;
    try {
      res = await executeShellCommand("git config user.name");
    } catch (e) {
      return null;
    }

    if (!res) {
      return null;
    }

    let userName = "";
    if (res.stdout.indexOf("\n") != -1) {
      userName = res.stdout.substring(0, res.stdout.length - 1);
    } else {
      userName = res.stdout;
    }

    if (userName == e.stderr.substring(3, e.stderr.indexOf("! "))) {
      return true;
    } else {
      return null;
    }
  }
};

const verifyUserCanUseGHCommands = async () => {
  let res;
  try {
    res = await executeShellCommand("gh auth status");
  } catch (err) {
    return (stderr = "Install gh CLI before continuing!");

    // let sysName = "";
    // sysName = os.platform().toLowerCase();
    // if (sysName.indexOf("win") != -1) {
    //   sysName = "Windows OS";
    // } else if (sysName.indexOf("mac") != -1) {
    //   sysName = "MacOS";
    // } else if (sysName.indexOf("x11") != -1) {
    //   sysName = "UNIX OS";
    // } else if (sysName.indexOf("linux") != -1) {
    //   sysName = "Linux OS";
    // } else {
    //   sysName = "Mobile?";
    // }

    // console.log(sysName);
  }

  if (res && res.stdout && !res.stderr) {
    return res;
  } else {
    return false;
  }
};

const verifyUserLogin = async () => {
  const userVerified = await executeShellCommand("ssh -T git@github.com", true);

  if (userVerified) {
    const userHasCmdLineGit = await verifyUserCanUseGHCommands();

    if (userHasCmdLineGit) {
      console.log("All good!");
      return true;
    } else {
      console.log(
        "User must log in to use the GitHub CLI! Run gh auth login To Proceed"
      );
      return false;
    }
  } else {
    console.log(
      "Please Make Sure You've Installed Git And GitHub CLI For This Application To Function Correctly And Use git & gh Commands"
    );
    return false;
  }
};

const checkIsRepository = async () => {
  const isAlreadyRepository = await executeShellCommand(
    "git rev-parse --is-inside-work-tree"
  );

  if (isAlreadyRepository && isAlreadyRepository.stdout.trim() == "true") {
    return true;
  } else {
    return false;
  }
};

const gitForceInit = async () => {
  const res = await executeShellCommand("git init");
  return res;
};

const gitForceDeInit = async () => {
  const res = await executeShellCommand("rm -rf .git");
  return res;
};

const gitInit = async () => {
  const isAlreadyALocalRepo = await checkIsRepository();
  if (!isAlreadyALocalRepo) {
    console.log("Initializing A New Repository");
    const res = await executeShellCommand("git init");

    if (res && res.stderr == "") {
      return res;
    }
  } else {
    const initAction = await inquirer.prompt({
      type: "list",
      name: "action",
      message: "What Would You Like To Do?",
      choices: ["Reinitialize Local Repository"],
    });
    switch (initAction.action) {
      case "Reinitialize Local Repository":
        gitForceInit();
        break;
    }

    return initAction.action;
  }
};

const getLoggedInUsersName = async () => {
  const res = await executeShellCommand("git config user.name");
  if (res && res.stdout && res.stderr == "") {
    return res.stdout.trim();
  } else {
    console.log("Unable to get username");
    return false;
  }
};

const getReposOfLoggedInUser = async () => {
  const userNameRes = await getLoggedInUsersName();

  if (!userNameRes) return;

  const res = await executeShellCommand(
    `gh search repos --owner ${userNameRes}`
  );

  if (res && res.stdout && res.stderr == "") {
    let fixedLineBreaks = res.stdout.replaceAll("\n", "\t");
    let urls = fixedLineBreaks.split("\t");
    let repos = [];
    urls.forEach((url) => {
      if (url.indexOf(userNameRes) !== -1) {
        repos.push(url.split("/")[1]);
      }
    });
    // console.log(res.stdout);
    return repos;
  } else {
    return false;
  }
};

const doesRepoOfNameExist = async (name) => {
  const usersReposRes = await getReposOfLoggedInUser();

  if (!usersReposRes) return false;

  let flag = false;
  usersReposRes.forEach((repo) => {
    if (String(repo).trim().toLowerCase() == name.trim().toLowerCase()) {
      flag = true;
    }
  });

  if (flag) return true;
  else return false;
};

const getNewRepoName = async () => {
  let newRepoName = null;
  while (!newRepoName) {
    newRepoName = await inquirer.prompt({
      type: "input",
      message: "What Would You Like To Name This Repository?",
      name: "value",
    });

    if (!newRepoName.value || newRepoName.value.trim() == "") {
      console.log("Name For Repo Cannot Be Blank");
      newRepoName = null;
    } else {
      const repoExistsRes = await doesRepoOfNameExist(newRepoName.value);
      if (repoExistsRes) {
        console.log(
          `Repository With Name ${
            newRepoName.value
          } Already Exists For User ${await getLoggedInUsersName()}`
        );
        newRepoName = null;
      }
    }
  }

  const confirmRepoName = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Is The Name ${newRepoName.value} Correct For The New Repository?`,
  });

  if (confirmRepoName.confirm) return newRepoName.value;
  else getNewRepoName();
};

const createRepo = async (repoName) => {
  const repoPrivacy = await inquirer.prompt({
    type: "list",
    name: "choice",
    message: "What Would You Like The Repository Privacy To Be?",
    choices: ["Public", "Private"],
  });

  let cmdString = `gh repo create ${repoName} --${repoPrivacy.choice.toLowerCase()}`;
  console.log(cmdString);
  const res = await executeShellCommand(cmdString);

  console.log(res);
  if (res && res.stdout && res.stderr == "") return res.stdout;
  else return false;
};

const addLocalChanges = async () => {
  const addRes = await executeShellCommand("git add .");
  if (!addRes) return false;
  else return true;
};

const commitLocalChanges = async (msg = "auto") => {
  const commitRes = await executeShellCommand(`git commit -m "${msg}"`);
  if (!commitRes || !commitRes.stdout || commitRes.stderr != "") return false;
  else return true;
};

const addRemoteOrigin = async (origin = "") => {
  if (origin == "") return false;
  const res = await executeShellCommand(
    `git remote add origin ${origin.trim()}.git`
  );
  console.log(res.stdout);
  if (res && res.stderr == "") return res;
  else return false;
};

const gitBranch = async (branchName = "main", main = false) => {
  const cmd = `git branch ${main ? `-M ` : ``}${branchName}`;
  console.log(cmd);
  const res = await executeShellCommand(cmd);
  if (res) return true;
  else return false;
};

const gitPush = async (branch = "main") => {
  const cmd = `git push -u origin ${branch}`;
  const res = await executeShellCommand(cmd);
  return res;
};

/* ==================== */
/* ACTUAL RUNTIME LOGIC */
/* ==================== */
const userCanUseCLI = await verifyUserLogin();

if (userCanUseCLI) {
  console.clear();

  let startMenuChoices = [
    "init (Create A New Repository)",
    "pull (Clone An Existing Repository)",
    "push (To Current Repository Or If No Repository Create New)",
    "branch (Checkout An Existing Branch Or Create A New One)",
  ];

  if ((await checkIsRepository()) == true) {
    startMenuChoices = [
      "pull (Clone An Existing Repository)",
      "push (To Current Repository Or If No Repository Create New)",
      "branch (Checkout An Existing Branch Or Create A New One)",
      "delete/reinit (If Messed Up/Templates Changed)",
    ];
  }

  const startMenuInput = await inquirer.prompt({
    type: "list",
    name: "action",
    message: "What Would You Like To Do?",
    choices: startMenuChoices,
  });

  switch (startMenuInput.action) {
    case "init (Create A New Repository)":
      await gitInit();
      const baseInitChoice = await inquirer.prompt({
        type: "list",
        name: "choice",
        message: "What Would You Like To Do With This Repository?",
        choices: [
          "Create New Repository And Upload",
          "Link To Existing Repository URL",
        ],
      });

      switch (baseInitChoice.choice) {
        case "Create New Repository And Upload":
          const newRepoName = await getNewRepoName();
          if (!newRepoName) break;
          const repoCreationRes = await createRepo(newRepoName);
          if (!repoCreationRes) break;
          const remoteOriginRes = await addRemoteOrigin(repoCreationRes);
          if (!remoteOriginRes) break;
          const branchRes = await gitBranch("main", true);
          if (!branchRes) break;
          const addRes = await addLocalChanges();
          if (!addRes) break;
          const commitMsg = await inquirer.prompt({
            type: "input",
            name: "input",
            message: "What Would You Like To Set As The Commit Message?",
          });
          const commitRes = await commitLocalChanges(commitMsg.input);
          if (!commitRes) break;

          const pushRes = await gitPush("main");
          if (pushRes.stdout.indexOf("branch") == 0 && pushRes.stderr != "") {
            console.log("Upload Complete!");
            console.log(`${repoCreationRes.trim()}, ${pushRes.stdout}`);
          }
          // const pushRes = await pushCommitted();
          break;
        case "Link To Existing Repository URL":
          break;
      }
      break;
    case "delete/reinit (If Messed Up/Templates Changed)":
      const reInitChoice = await inquirer.prompt({
        type: "list",
        name: "choice",
        message: "What Would You Like To Do With This Repository?",
        choices: [
          "Reinitialize",
          "Remove .git (Will FULLY DELETE .git Folder From Workspace)",
        ],
      });

      switch (reInitChoice.choice) {
        case "Reinitialize":
          await gitInit();
          break;
        case "Remove .git (Will FULLY DELETE .git Folder From Workspace)":
          const removeGitRes = await gitForceDeInit();
          if (removeGitRes && removeGitRes.stderr == "") {
            console.log(
              "Successfully Removed .git Folder From Workspace, If You Don't See This Change Reflected, Please Hit CTRL/CMD + SHIFT + P Then Search 'Reload Window'"
            );
          } else {
            console.log(
              `Error, ${removeGitRes.stderr}, Please Try Running rm -rf .git In The Current Directory To Manually Attempt This Step`
            );
          }

          break;
      }
      break;
    case "pull (Clone An Existing Repository)":
      console.log("pull!");
      break;
    case "push (To Current Repository Or If No Repository Create New)":
      console.log("push!");
      break;
    case "branch (Checkout An Existing Branch Or Create A New One)":
      console.log("branch!");
      break;
    default:
      console.log("unhandled!!");
      break;
  }
}
