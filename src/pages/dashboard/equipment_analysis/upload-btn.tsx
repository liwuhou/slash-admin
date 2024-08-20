import { useState } from 'react';
import { read as readXlsx } from 'xlsx';
import type { WorkBook } from 'xlsx';
import { Button, Flex, Popover, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

interface Prop {
  onUpload?: (w: WorkBook) => void;
  onReset?: () => void;
  onCheck?: () => boolean;
  style?: React.CSSProperties;
  onConfirm: () => void;
}

export enum FunctionMode {
  port,
  equipment,
}

const { Dragger } = Upload;

const DraggerUploadArea: React.FC<
  UploadProps & { description?: string; content?: JSX.Element }
> = ({ description = '点击或拖入文件以上传', content, ...props }) => {
  return (
    <Popover content={content}>
      <Dragger {...props}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{description}</p>
      </Dragger>
    </Popover>
  );
};

const UploadBtnTip: React.FC<{href: string}> = ({href}) => {
  return (
    <div>
      <div>点击或拖入文件以上传</div>
      <div><a href={href}>点击下载模板文件</a></div>
    </div>
  )
}

const UploadBtn: React.FC<Prop> = ({ onUpload, onReset, onCheck, onConfirm, style }) => {
  const [hasFile, setHasFile] = useState(false);
  const handleReset = () => {
    if (!hasFile) return false;
    setHasFile(false);
    message.success('重置成功');
    onReset?.();
  };
  const handleClickConfirm = () => {
    if (onCheck?.() ?? true) {

      onConfirm?.()
      setHasFile(true);
    }
  }

  const getFileBinaryString = (file: File) => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = function (e) {
        resolve(e?.target?.result);
      };
      fileReader.onerror = function (e) {
        reject(e);
      };
      fileReader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange: UploadProps['onChange'] = async (info) => {
    console.log('🤔 ~ consthandleFileChange:UploadProps[]= ~ info:', info)
    if (hasFile) return false;
    const { fileList } = info;
    const file = fileList[fileList.length - 1];
    const data = await getFileBinaryString(file.originFileObj!);

    const workBook = readXlsx(data, { type: 'array' });
    onUpload?.(workBook);
  };

  return (
    <Flex gap="middle" style={style}>
      {!hasFile && [
        <DraggerUploadArea
          onChange={handleFileChange}
          multiple={false}
          name="handleFile"
          showUploadList={false}
          beforeUpload={() => false}
          content={<UploadBtnTip href="" />}
          description="原始台账文件"
        />,
        <DraggerUploadArea
          onChange={handleFileChange}
          multiple={false}
          name="originFile"
          showUploadList={false}
          beforeUpload={() => false}
          content={<UploadBtnTip href="" />}
          description="资源系统导出文件"
        />,
      ]}
      <Button onClick={handleReset}>重置</Button>
      <Button type="primary" onClick={handleClickConfirm}>对比</Button>
    </Flex>
  );
};

export default UploadBtn;
