const { machineIdSync } = require('node-machine-id');

function getMachineId() {
  return machineIdSync();
}

module.exports = { getMachineId };