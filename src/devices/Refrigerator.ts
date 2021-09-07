import {LGThinQHomebridgePlatform} from '../platform';
import {CharacteristicValue, PlatformAccessory} from 'homebridge';
import {Device} from '../lib/Device';
import {baseDevice} from '../baseDevice';
import {DeviceModel} from '../lib/DeviceModel';

export default class Refrigerator extends baseDevice {
  protected serviceLabel;
  protected serviceFreezer;
  protected serviceFridge;
  protected serviceDoorOpened;
  protected serviceExpressMode;
  protected serviceExpressFridge;
  protected serviceEcoFriendly;

  constructor(
    protected readonly platform: LGThinQHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    const {
      Service: {
        ContactSensor,
        Switch,
        ServiceLabel,
      },
      Characteristic,
    } = this.platform;
    const device: Device = accessory.context.device;

    this.serviceLabel = accessory.getService(ServiceLabel) || accessory.addService(ServiceLabel, device.name);
    this.serviceLabel.setCharacteristic(Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.DOTS);

    this.serviceFridge = this.createThermostat('Fridge', 'fridgeTemp');
    this.serviceFridge.updateCharacteristic(Characteristic.TargetTemperature, this.Status.fridgeTemperature);
    this.serviceFridge.addLinkedService(this.serviceLabel);

    this.serviceFreezer = this.createThermostat('Freezer', 'freezerTemp');
    this.serviceFreezer.updateCharacteristic(Characteristic.TargetTemperature, this.Status.freezerTemperature);
    this.serviceFreezer.addLinkedService(this.serviceLabel);

    // Door open state
    this.serviceDoorOpened = accessory.getService(ContactSensor) || accessory.addService(ContactSensor, 'Refrigerator Door Closed');
    this.serviceDoorOpened.addLinkedService(this.serviceLabel);

    this.serviceExpressMode = accessory.getService('Express Freezer');
    if (this.config.ref_express_freezer && 'expressMode' in device.snapshot?.refState) {
      this.serviceExpressMode = this.serviceExpressMode || accessory.addService(Switch, 'Express Freezer', 'Express Freezer');
      this.serviceExpressMode.getCharacteristic(Characteristic.On).onSet(this.setExpressMode.bind(this));
      this.serviceExpressMode.addLinkedService(this.serviceLabel);
    } else if (this.serviceExpressMode) {
      accessory.getService(this.serviceExpressMode);
    }

    this.serviceExpressFridge = accessory.getService('Express Fridge');
    if (this.config.ref_express_fridge && 'expressFridge' in device.snapshot?.refState) {
      // eslint-disable-next-line max-len
      this.serviceExpressFridge = this.serviceExpressFridge || accessory.addService(Switch, 'Express Fridge', 'Express Fridge');
      this.serviceExpressFridge.getCharacteristic(Characteristic.On).onSet(this.setExpressFridge.bind(this));
      this.serviceExpressFridge.addLinkedService(this.serviceLabel);
    } else if (this.serviceExpressFridge) {
      accessory.getService(this.serviceExpressFridge);
    }

    this.serviceEcoFriendly = accessory.getService('Eco Friendly');
    if (this.config.ref_eco_friendly && 'ecoFriendly' in device.snapshot?.refState) {
      this.serviceEcoFriendly = this.serviceEcoFriendly || accessory.addService(Switch, 'Eco Friendly', 'Eco Friendly');
      this.serviceExpressFridge.getCharacteristic(Characteristic.On).onSet(this.setEcoFriendly.bind(this));
      this.serviceExpressFridge.addLinkedService(this.serviceLabel);
    } else if (this.serviceEcoFriendly) {
      accessory.getService(this.serviceEcoFriendly);
    }

    this.updateAccessoryCharacteristic(device);
  }

  public get config() {
    return Object.assign({}, {
      ref_express_freezer: false,
      ref_express_fridge: false,
      ref_eco_friendly: false,
    }, super.config);
  }

  public get Status() {
    return new RefrigeratorStatus(this.accessory.context.device.snapshot?.refState, this.accessory.context.device.deviceModel);
  }

  /**
   * update accessory characteristic by device
   */
  public updateAccessoryCharacteristic(device: Device) {
    super.updateAccessoryCharacteristic(device);

    if (!device.online) {
      // device not online, do not update status
      return;
    }

    const {Characteristic} = this.platform;

    this.serviceFreezer.updateCharacteristic(Characteristic.CurrentTemperature, this.Status.freezerTemperature);
    this.serviceFreezer.updateCharacteristic(Characteristic.TargetTemperature, this.Status.freezerTemperature);

    this.serviceFridge.updateCharacteristic(Characteristic.CurrentTemperature, this.Status.fridgeTemperature);
    this.serviceFridge.updateCharacteristic(Characteristic.TargetTemperature, this.Status.fridgeTemperature);

    const contactSensorValue = this.Status.isDoorClosed ?
      Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    this.serviceDoorOpened.updateCharacteristic(Characteristic.ContactSensorState, contactSensorValue);

    if (this.config.ref_express_freezer && 'expressMode' in device.snapshot?.refState) {
      this.serviceExpressMode.updateCharacteristic(Characteristic.On, this.Status.isExpressModeOn);
    }

    if (this.config.ref_express_fridge && 'expressFridge' in device.snapshot?.refState) {
      this.serviceExpressFridge.updateCharacteristic(Characteristic.On, this.Status.isExpressFridgeOn);
    }

    if (this.config.ref_eco_friendly && 'ecoFriendly' in device.snapshot?.refState) {
      this.serviceEcoFriendly.updateCharacteristic(Characteristic.On, this.Status.isEcoFriendlyOn);
    }
  }

  async setExpressMode(value: CharacteristicValue) {
    const device: Device = this.accessory.context.device;
    const On = device.deviceModel.lookupMonitorName('expressMode', '@CP_ON_EN_W');
    const Off = device.deviceModel.lookupMonitorName('expressMode', '@CP_OFF_EN_W');
    this.platform.ThinQ?.deviceControl(device.id, {
      dataKey: null,
      dataValue: null,
      dataSetList: {
        refState: {
          expressMode: value as boolean ? On : Off,
          tempUnit: this.Status.tempUnit,
        },
      },
      dataGetList: null,
    });
    this.platform.log.debug('Set Express Freezer ->', value);
  }

  async setExpressFridge(value: CharacteristicValue) {
    const device: Device = this.accessory.context.device;
    const On = device.deviceModel.lookupMonitorName('expressFridge', '@CP_ON_EN_W');
    const Off = device.deviceModel.lookupMonitorName('expressFridge', '@CP_OFF_EN_W');
    this.platform.ThinQ?.deviceControl(device.id, {
      dataKey: null,
      dataValue: null,
      dataSetList: {
        refState: {
          expressFridge: value as boolean ? On : Off,
          tempUnit: this.Status.tempUnit,
        },
      },
      dataGetList: null,
    });
    this.platform.log.debug('Set Express Fridge ->', value);
  }

  async setEcoFriendly(value: CharacteristicValue) {
    const device: Device = this.accessory.context.device;
    const On = device.deviceModel.lookupMonitorName('ecoFriendly', '@CP_ON_EN_W');
    const Off = device.deviceModel.lookupMonitorName('ecoFriendly', '@CP_OFF_EN_W');
    this.platform.ThinQ?.deviceControl(device.id, {
      dataKey: null,
      dataValue: null,
      dataSetList: {
        refState: {
          ecoFriendly: value as boolean ? On : Off,
          tempUnit: this.Status.tempUnit,
        },
      },
      dataGetList: null,
    });
    this.platform.log.debug('Set Eco Friendly ->', value);
  }

  async tempUnit() {
    const {
      Characteristic: {
        TemperatureDisplayUnits,
      },
    } = this.platform;
    return this.Status.tempUnit === 'CELSIUS' ? TemperatureDisplayUnits.CELSIUS : TemperatureDisplayUnits.FAHRENHEIT;
  }

  /**
   * create a thermostat service
   */
  protected createThermostat(name: string, key: string) {
    const device: Device = this.accessory.context.device;
    const {Characteristic} = this.platform;
    const isCelsius = this.Status.tempUnit === 'CELSIUS';
    const service = this.accessory.getService(name) || this.accessory.addService(this.platform.Service.Thermostat, name, name);

    // cool only
    service.setCharacteristic(Characteristic.CurrentHeatingCoolingState, Characteristic.CurrentHeatingCoolingState.COOL);
    service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .setProps({
        minValue: Characteristic.TargetHeatingCoolingState.COOL,
        maxValue: Characteristic.TargetHeatingCoolingState.COOL,
      });
    service.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);

    service.getCharacteristic(Characteristic.TemperatureDisplayUnits).setProps({
      minValue: Characteristic.TemperatureDisplayUnits.CELSIUS,
      maxValue: Characteristic.TemperatureDisplayUnits.FAHRENHEIT,
    }).onGet(this.tempUnit.bind(this));

    const valueMapping = device.deviceModel.monitoringValueMapping(key + '_C') || device.deviceModel.monitoringValueMapping(key);
    const values = Object.values(valueMapping)
      .map(value => {
        if (value && typeof value === 'object' && 'label' in value) {
          return parseInt(value['label'] as string);
        }

        return parseInt(value as string);
      })
      .filter(value => {
        return !isNaN(value);
      });

    service.getCharacteristic(Characteristic.TargetTemperature)
      .onSet(async (value: CharacteristicValue) => { // value in celsius
        let indexValue;
        if (this.Status.tempUnit === 'FAHRENHEIT') {
          indexValue = device.deviceModel.lookupMonitorName(key + '_F', cToF(value as number).toString())
            || device.deviceModel.lookupMonitorName(key, cToF(value as number).toString());
        } else {
          indexValue = device.deviceModel.lookupMonitorName(key + '_C', value.toString())
            || device.deviceModel.lookupMonitorName(key, value.toString());
        }

        if (!indexValue) {
          throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.INVALID_VALUE_IN_REQUEST);
        }

        await this.setTemperature(key, indexValue);
      })
      .setProps({minValue: Math.min(...values), maxValue: Math.max(...values), minStep: isCelsius ? 1 : 0.1});

    return service;
  }

  async setTemperature(key: string, temp: string) {
    const device: Device = this.accessory.context.device;
    await this.platform.ThinQ?.deviceControl(device.id, {
      dataKey: null,
      dataValue: null,
      dataSetList: {
        refState: {
          [key]: parseInt(temp),
          tempUnit: this.Status.tempUnit,
        },
      },
      dataGetList: null,
    });
  }
}

export class RefrigeratorStatus {
  constructor(protected data, protected deviceModel: DeviceModel) {
  }

  public get freezerTemperature() {
    if (this.tempUnit === 'FAHRENHEIT') {
      return fToC(parseInt(this.deviceModel.lookupMonitorValue('freezerTemp_F', this.data?.freezerTemp, '0')));
    }

    return parseInt(this.deviceModel.lookupMonitorValue('freezerTemp_C', this.data?.freezerTemp, '0'));
  }

  public get fridgeTemperature() {
    if (this.tempUnit === 'FAHRENHEIT') {
      return fToC(parseInt(this.deviceModel.lookupMonitorValue( 'fridgeTemp_F', this.data?.fridgeTemp, '0')));
    }

    return parseInt(this.deviceModel.lookupMonitorValue('fridgeTemp_C', this.data?.fridgeTemp, '0'));
  }

  public get isDoorClosed() {
    return this.data?.atLeastOneDoorOpen === 'CLOSE';
  }

  public get isExpressModeOn() {
    return this.data?.expressMode === this.deviceModel.lookupMonitorName('expressMode', '@CP_ON_EN_W');
  }

  public get isExpressFridgeOn() {
    return this.data?.expressFridge === this.deviceModel.lookupMonitorName('expressFridge', '@CP_ON_EN_W');
  }

  public get isEcoFriendlyOn() {
    return this.data?.ecoFriendly === this.deviceModel.lookupMonitorName('ecoFriendly', '@CP_ON_EN_W');
  }

  public get tempUnit() {
    return this.data?.tempUnit || 'CELSIUS';
  }
}

export function fToC(fahrenheit) {
  return parseFloat(((fahrenheit - 32) * 5 / 9).toFixed(1));
}

export function cToF(celsius) {
  return Math.round(celsius * 9 / 5 + 32);
}
