package contracts

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type DeviceContract struct {
	contractapi.Contract
}


type Device struct {
	ID	string `json:"id"`
	Yuniq	string `json:"yuniq"`
	Owner	string `json:"owner"`
	AddedAt uint64 `json:"addedAt"`
}

func (s *DeviceContract) CreateDevice(ctx contractapi.TransactionContextInterface, deviceData string) (string, error) {

	if len(deviceData) == 0 {
		return "", fmt.Errorf("Please pass the correct device data")
	}

	var device Device
	err := json.Unmarshal([]byte(deviceData), &device)
	if err != nil {
		return "", fmt.Errorf("Failed while unmarshling device. %s", err.Error())
	}

	deviceAsBytes, err := json.Marshal(device)
	if err != nil {
		return "", fmt.Errorf("Failed while marshling device. %s", err.Error())
	}

	ctx.GetStub().SetEvent("CreateAsset", deviceAsBytes)

	return ctx.GetStub().GetTxID(), ctx.GetStub().PutState(device.ID, deviceAsBytes)
}

func (s *DeviceContract) GetHistoryForAsset(ctx contractapi.TransactionContextInterface, deviceID string) (string, error) {

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(deviceID)
	if err != nil {
		return "", fmt.Errorf(err.Error())
	}
	defer resultsIterator.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		device, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf(err.Error())
		}
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(device.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		if device.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(device.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(device.Timestamp.Seconds, int64(device.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(device.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	return string(buffer.Bytes()), nil
}

func (s *DeviceContract) GetDeviceById(ctx contractapi.TransactionContextInterface, deviceID string) (*Device, error) {
	if len(deviceID) == 0 {
		return nil, fmt.Errorf("Please provide correct device Id")
		// return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	deviceAsBytes, err := ctx.GetStub().GetState(deviceID)

	if err != nil {
		return nil, fmt.Errorf("Failed to read from world state. %s", err.Error())
	}

	if deviceAsBytes == nil {
		return nil, fmt.Errorf("%s does not exist", deviceID)
	}

	device := new(Device)
	_ = json.Unmarshal(deviceAsBytes, device)

	return device, nil

}

func (s *DeviceContract) DeleteDeviceById(ctx contractapi.TransactionContextInterface, deviceID string) (string, error) {
	if len(deviceID) == 0 {
		return "", fmt.Errorf("Please provide correct contract Id")
	}

	return ctx.GetStub().GetTxID(), ctx.GetStub().DelState(deviceID)
}
