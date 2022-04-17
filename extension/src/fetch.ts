import fetch from 'node-fetch'
import type { ExtensionContext } from 'vscode'
import { window, workspace } from 'vscode'
import { MSG_PREFIX, URL_PREFIX, FILE } from './constants'
import { getConfig } from './config'

export async function fetchLatest() {
  const repo = getConfig<string>('fileNestingUpdater.upstreamRepo')
  const branch = getConfig<string>('fileNestingUpdater.upstreamBranch')
  const url = `${URL_PREFIX}/${repo}@${branch}/${FILE}`
  const md = await fetch(url).then(r => r.text())
  const content = (md.match(/```jsonc([\s\S]*?)```/) || [])[1] || ''

  const json = `{${
    content
      .trim()
      .split(/\n/g)
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      .slice(0, -1)
  }}`

  const config = JSON.parse(json) || {}
  return config['explorer.experimental.fileNesting.patterns']
}

export async function fetchAndUpdate(ctx: ExtensionContext, prompt = true) {
  const patterns = await fetchLatest()
  let shouldUpdate = true

  if (prompt) {
    const buttonUpdate = 'Update'
    const buttonSkip = 'Skip this time'
    const result = await window.showInformationMessage(
      `${MSG_PREFIX} new config found, do you want to update?`,
      buttonUpdate,
      buttonSkip,
    )
    shouldUpdate = result === buttonUpdate
  }

  if (shouldUpdate) {
    const config = workspace.getConfiguration()
    config.update('explorer.experimental.fileNesting.enabled', true, true)
    if (config.inspect('explorer.experimental.fileNesting.expand').globalValue == null)
      config.update('explorer.experimental.fileNesting.expand', false, true)
    config.update('explorer.experimental.fileNesting.patterns', {
      '//': `Last update at ${new Date().toLocaleString()}`,
      ...patterns,
    }, true)

    ctx.globalState.update('lastUpdate', Date.now())

    window.showInformationMessage(`${MSG_PREFIX} Config updated`)
  }
}