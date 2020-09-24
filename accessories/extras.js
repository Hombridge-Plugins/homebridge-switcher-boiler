let switcher, log, Characteristic

const Extras = (service, accessory, device) => {
	switcher = device
	Characteristic = accessory.api.hap.Characteristic
	log = accessory.log
	accessory.totalEnergy = 0
	accessory.totalEnergyTemp = 0
	accessory.lastReset = 0
	accessory.lastStateTime = new Date()

	const EnergyCharacteristics = require('./lib/EnergyCharacteristics')(Characteristic)

	
	service.getCharacteristic(Characteristic.SetDuration)
		.setProps({
			maxValue: 86340,
			minValue: 3600,
			minStep: 60
		})
		.on('get', getDuration)
		.on('set', setDuration)

	service.getCharacteristic(Characteristic.RemainingDuration)
		.setProps({
			maxValue: 86340,
			minValue: 0,
			minStep: 1
		})
		.on('get', getRemainingDuration)


	service.getCharacteristic(EnergyCharacteristics.Volts)
		.on('get', getVolts)

	service.getCharacteristic(EnergyCharacteristics.Amperes)
		.on('get', getAmperes)

	service.getCharacteristic(EnergyCharacteristics.Watts)
		.on('get', getWatts)



	if (accessory.loggingService) {

		service.getCharacteristic(EnergyCharacteristics.KilowattHours)
			.on('get', (callback) => {
				const extraPersistedData = accessory.loggingService.getExtraPersistedData()
				if (extraPersistedData != undefined)
					accessory.totalEnergy = extraPersistedData.totalEnergy
				log.debug("Total Consumption: " + accessory.totalEnergy)
				callback(null, accessory.totalEnergy)
			})

		service.getCharacteristic(EnergyCharacteristics.ResetTotal)
			.on('set', (value, callback) => {
				accessory.totalEnergy = 0
				accessory.lastReset = value
				accessory.loggingService.setExtraPersistedData({ totalEnergy: accessory.totalEnergy, lastReset: accessory.lastReset })
				callback(null)
			})
			.on('get', (callback) => {
				const extraPersistedData = accessory.loggingService.getExtraPersistedData()
				if (extraPersistedData != undefined)
					accessory.lastReset = extraPersistedData.lastReset
				callback(null, accessory.lastReset)
			})
	}

	return  { 
		updateHomeKit: () => {
			service.getCharacteristic(Characteristic.RemainingDuration).updateValue(switcher.state.remaining_seconds)
			service.getCharacteristic(Characteristic.SetDuration).updateValue(switcher.state.default_shutdown_seconds)
			service.getCharacteristic(EnergyCharacteristics.Watts).getValue(null)
			service.getCharacteristic(EnergyCharacteristics.Volts).getValue(null)
			service.getCharacteristic(EnergyCharacteristics.Amperes).getValue(null)
			if (accessory.loggingService) {
				service.getCharacteristic(EnergyCharacteristics.KilowattHours).getValue(null)

				const timeSinceLastState = new Date() - accessory.lastStateTime
				accessory.lastStateTime = new Date()
				if (accessory.loggingService.isHistoryLoaded()) {
					const extraPersistedData = accessory.loggingService.getExtraPersistedData()
					if (extraPersistedData != undefined) {
						accessory.totalEnergy = extraPersistedData.totalEnergy + accessory.totalEnergyTemp + switcher.state.power_consumption * (timeSinceLastState / 1000) / 3600 / 1000
						accessory.loggingService.setExtraPersistedData({ totalEnergy: accessory.totalEnergy, lastReset: extraPersistedData.lastReset })
					}
					else {
						accessory.totalEnergy = accessory.totalEnergyTemp + switcher.state.power_consumption * (timeSinceLastState / 1000) / 3600 / 1000
						accessory.loggingService.setExtraPersistedData({ totalEnergy: accessory.totalEnergy, lastReset: 0 })
					}
					accessory.totalEnergyTemp = 0
		
				} else {
					accessory.totalEnergyTemp = accessory.totalEnergyTemp + switcher.state.power_consumption * (timeSinceLastState / 1000) / 3600 / 1000
					accessory.totalEnergy = accessory.totalEnergyTemp
				}
		
				
				accessory.loggingService.addEntry({time: Math.floor((new Date()).getTime()/1000), power: switcher.state.power_consumption})
			}
		}
	}
}


module.exports = Extras

const getVolts = (callback) => {
	if (!switcher) {
		callback('switcher has yet to connect');
		return
	}
	const volts = switcher.state.state ? 220 : 0
	callback(null, volts)
}

const getAmperes = (callback) => {
	if (!switcher) {
		callback('switcher has yet to connect');
		return
	}
	const amperes = Number(Math.round(switcher.state.power_consumption/220 + "e1") + "e-1")
	callback(null, amperes)
}

const getWatts = (callback) => {
	if (!switcher) {
		callback('switcher has yet to connect');
		return
	}
	const watts = switcher.state.power_consumption
	callback(null, watts)
}

const getDuration = (callback) => {
	if (!switcher) {
		callback('switcher has yet to connect');
		return
	}
	const duration = switcher.state.default_shutdown_seconds
	log.debug("Auto Shutdown in Seconds:" + duration)
	callback(null, duration)
}

const getRemainingDuration = (callback) => {
	if (!switcher) {
		callback('switcher has yet to connect');
		return
	}
	const duration = switcher.state.remaining_seconds
	log.debug("Remaining duration in Seconds:" + duration)
	callback(null, duration)
}

const setDuration = (seconds, callback) => {
	if (!switcher) {
		callback('switcher has yet to connect');
		return
	}

	const hours = Math.floor(seconds / 60 / 60)
	const minutes = Math.floor(seconds / 60) % 60
	const formattedTime = hours + ':' + minutes

	log("Setting new \"Auto Shutdown\" time - " + formattedTime)
	switcher.set_default_shutdown(seconds)
	callback()
}