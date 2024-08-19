import { useState } from 'react'
import { read as readXlsx } from 'xlsx'
import type { WorkBook } from 'xlsx'
import { Button, Flex, Radio, Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { RadioChangeEvent, UploadProps } from 'antd'

interface Prop {
  type: FunctionMode
  onUpload?: (w: WorkBook) => void
  onReset?: () => void
  onCheck?: (w: WorkBook) => boolean
  style?: React.CSSProperties
  onModeChange: (w: FunctionMode) => void
}

export enum FunctionMode {
  port,
  equipment,
}

const { Dragger } = Upload

const DraggerUploadArea: React.FC<UploadProps> = (props) => {
  return (
    <Dragger {...props}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">点击或拖入文件以上传</p>
    </Dragger>
  )
}

const UploadBtn: React.FC<Prop> = ({ onUpload, onReset, onCheck, onModeChange, style, type }) => {
  const [hasFile, setHasFile] = useState(false)
  const handleReset = () => {
    if (!hasFile) return false
    setHasFile(false)
    message.success('重置成功')
    onReset?.()
  }

  const getFileBinaryString = (file: File) => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.onload = function (e) {
        resolve(e?.target?.result)
      }
      fileReader.onerror = function (e) {
        reject(e)
      }
      fileReader.readAsArrayBuffer(file)
    })
  }

  const handleFileChange: UploadProps['onChange'] = async (info) => {
    if (hasFile) return false
    const { fileList } = info
    const file = fileList[fileList.length - 1]
    const data = await getFileBinaryString(file.originFileObj!)

    const workBook = readXlsx(data, { type: 'array' })
    if (onCheck?.(workBook) ?? true) {
      setHasFile(true)
      onUpload?.(workBook)
    }
  }

  const onChange = (e: RadioChangeEvent) => {
    onModeChange?.(e.target.value)
  }

  return (
    <Flex gap="middle" style={style}>
      {!hasFile && (
        <DraggerUploadArea
          onChange={handleFileChange}
          multiple={false}
          name="file"
          showUploadList={false}
          beforeUpload={() => false}
        />
      )}
      <Button onClick={handleReset}>重置</Button>
      {!hasFile && (
        <Radio.Group onChange={onChange} value={type}>
          <Radio value={FunctionMode.equipment}>设备信息</Radio>
          <Radio value={FunctionMode.port}>端口信息</Radio>
        </Radio.Group>
      )}
    </Flex>
  )
}

export default UploadBtn
