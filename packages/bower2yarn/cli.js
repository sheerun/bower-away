#!/usr/bin/env node

const meow = require('meow')
const bowerConfig = require('bower-config')
const which = require('which')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs')
const { startsWith } = require('lodash')
const execa = require('execa')

const cli = meow(
  `
  Usage
    $ bower2yarn

  Please call this command for next step to convert your project to Yarn
  `
)

function help () {
  console.log(cli.help)
  process.exit(1)
}

let i = 0
const complete = []

function task (task) {
  complete.push(`${++i}. ${task}`)
}

function step (lines, last = false) {
  if (complete.length > 0) {
    console.log()
    console.log(chalk.green(complete.join('\n')))
  }

  console.log()
  console.log(chalk.red(lines.join('\n')))

  if (!last) {
    console.log()
    console.log(
      chalk.gray("Please call bower2yarn once more when you're done with this!")
    )
  }

  console.log()

  process.exit(0)
}

function exists (bin) {
  var path

  try {
    path = which.sync(bin)
  } catch (e) {
    return false
  }

  return path
}

async function main () {
  const cwd = process.cwd()

  task('Install Yarn')

  const yarnPath = exists('yarn', cwd)

  if (!yarnPath) {
    step([
      'A good first step to migrate to Yarn is installing it!',
      '',
      'Please choose your preferred method:',
      'https://yarnpkg.com/lang/en/docs/install/',
      '',
      'One good way to install it is:',
      '$ npm install -g yarn',
      '',
      "At the end you should be able to confirm Yarn's version with:",
      '$ yarn --version',
      '',
      'THE MINIMUM SUPPORTED VERSION OF YARN IS 1.0.0!'
    ])
  }

  task('Install Bower with Yarn')

  const bowerPath = exists('bower')

  if (!bowerPath) {
    step([
      'We cannot drop Bower just yet, we need it to install legacy dependencies.',
      '',
      'As a first step, please install Bower with:',
      '$ npm install -g bower',
      '',
      '...or if your project requires specific version of Bower:',
      '$ npm install -g bower@1.4.x',
      '',
      "At the end you should be able to confirm Bower's version with:",
      '$ bower --version'
    ])
  }

  task('Install dependencies')

  const config = bowerConfig.read(cwd)
  const componentsDir = path.resolve(cwd, config.directory)

  if (!fs.existsSync(componentsDir)) {
    step([
      'We need to install dependencies the old way first. Please run:',
      '$ bower install',
      '',
      'At the end you should see some packages in:',
      componentsDir
    ])
  }

  task('Create or update package.json')

  const expected = {}

  const pkgs = fs.readdirSync(componentsDir)

  for (const pkg of pkgs) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(componentsDir, pkg, '.bower.json'))
    )

    let source = manifest._source
    let target = manifest._target

    if (source.slice(0, 19) === 'https://github.com/') {
      source = source.slice(19)

      if (source.slice(-4) === '.git') {
        source = source.slice(0, -4)
      }

      source = source
    }

    if (!('dependencies' in expected)) {
      expected.dependencies = {}
    }

    expected.dependencies[`@bower_components/${pkg}`] = `${source}#${target}`
  }

  console.log(JSON.stringify(expected, null, 2))

  step(
    ['Your project is now converted to Yarn. Thank you for using Bower!'],
    true
  )
}

main()
