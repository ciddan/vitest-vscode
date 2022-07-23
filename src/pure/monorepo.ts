import { existsSync } from 'fs'
import path from 'path'
import * as vscode from 'vscode'
import globby from 'globby'
import { readFile } from 'fs-extra'
import type { PackageJson } from 'type-fest'
import type { WorkspaceFolder } from 'vscode'
import { parse as parseYaml } from 'yaml'

const getPnpmWorkspacesPath = (folder: string) => path.join(folder, 'pnpm-workspace.yaml')
const getPkgJsonPath = (folder: string) => path.join(folder, 'package.json')

export async function isMonorepo(projectRoot: string | WorkspaceFolder): Promise<boolean> {
  if (typeof projectRoot !== 'string')
    return isMonorepo(projectRoot.uri.fsPath)

  return hasPnpmWorkspaceConfig(projectRoot) || await hasPackageJsonWorkspaceConfig(projectRoot)
}

export async function getWorkspaceFolders(projectRoot: WorkspaceFolder): Promise<WorkspaceFolder[]> {
  let workspacePaths: string[]

  if (hasPnpmWorkspaceConfig(projectRoot.uri.fsPath)) {
    const yamlString = await readFile(getPnpmWorkspacesPath(projectRoot.uri.fsPath), 'utf-8')
    const pnpmWorkspaceConfig = parseYaml(yamlString)
    workspacePaths = pnpmWorkspaceConfig.packages
  }
  else {
    const pkgJson = JSON.parse(await readFile(getPkgJsonPath(projectRoot.uri.fsPath), 'utf-8')) as PackageJson

    if (Array.isArray(pkgJson.workspaces))
      workspacePaths = pkgJson.workspaces ?? []
    else
      workspacePaths = pkgJson.workspaces?.packages ?? []
  }

  const paths = await globby(workspacePaths, { absolute: true, cwd: projectRoot.uri.fsPath, onlyDirectories: true })
  const uris = paths.map(path => vscode.Uri.parse(path))

  return uris.map((uri, index) => ({ name: uri.fsPath.replace(`${projectRoot.uri.fsPath}/`, ''), index, uri }))
}

function hasPnpmWorkspaceConfig(projectRoot: string): boolean {
  return existsSync(getPnpmWorkspacesPath(projectRoot))
}

async function hasPackageJsonWorkspaceConfig(projectRoot: string): Promise<boolean> {
  const pkgJson = JSON.parse(await readFile(getPkgJsonPath(projectRoot), 'utf-8')) as PackageJson
  return pkgJson.workspaces != null
}
