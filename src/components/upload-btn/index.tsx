import { useState } from 'react';
import { read as readXlsx } from 'xlsx';
import type { WorkBook } from 'xlsx';
import { Button, Flex, Popover, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { UploadChangeParam } from 'antd/es/upload';
import { UploadFile } from 'antd/lib/upload';

export enum FileType {
  HANDLE,
  ORIGIN,
}

type OnUpload = (type: FileType, w: WorkBook) => void;

interface Prop {
  onUpload?: OnUpload;
  onReset?: () => void;
  style?: React.CSSProperties;
  onConfirm: () => void;
  label: [{label: string, link: string}, {label: string, link: string}]
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

const UploadBtnTip: React.FC<{ href: string }> = ({ href }) => {
  return (
    <div>
      <div>点击或拖入文件以上传</div>
      <div>
        <a href={href}>点击下载模板文件</a>
      </div>
    </div>
  );
};

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

const UploadBtn: React.FC<Prop> = ({
  onUpload,
  onReset,
  onConfirm,
  style,
  label
}) => {
  const [handleLabel, originLabel] = label
  const [hasHandleFile, setHandleFile] = useState(false);
  const [hasOriginFile, setHasOriginFile] = useState(false);
  const handleReset = () => {
    setHandleFile(false);
    setHasOriginFile(false);
    message.success('重置成功');
    onReset?.();
  };
  const handleClickConfirm = () => {
    onConfirm?.();
  };

  const formatFileChange = async (info: UploadChangeParam<UploadFile<any>>): Promise<WorkBook> => {
    const { fileList } = info;
    const file = fileList[fileList.length - 1];
    const data = await getFileBinaryString(file.originFileObj!);

    const workBook = readXlsx(data, { type: 'array' });
    return workBook;
  };

  const getFile = async(type: FileType, info: UploadChangeParam<UploadFile<any>>) => {
    const workBook = await formatFileChange(info);
    onUpload?.(type, workBook)
    if (type === FileType.HANDLE) {
      setHandleFile(true)
    } else {
      setHasOriginFile(true)
    }
  }
  
  return (
    <Flex gap="middle" style={style}>
      {!hasHandleFile && (
        <DraggerUploadArea
          onChange={getFile.bind(null, FileType.HANDLE)}
          multiple={false}
          name="handleFile"
          showUploadList={false}
          beforeUpload={() => false}
          content={<UploadBtnTip href={handleLabel.link} />}
          description={handleLabel.label}
        />
      )}
      {!hasOriginFile && (
        <DraggerUploadArea
          onChange={getFile.bind(null, FileType.ORIGIN)}
          multiple={false}
          name="originFile"
          showUploadList={false}
          beforeUpload={() => false}
          content={<UploadBtnTip href={originLabel.link} />}
          description={originLabel.label}
        />
      )}
      <Button onClick={handleReset}>重置</Button>
      <Button type="primary" onClick={handleClickConfirm}>
        对比
      </Button>
    </Flex>
  );
};

export default UploadBtn;
