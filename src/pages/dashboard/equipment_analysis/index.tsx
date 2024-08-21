import { useState } from 'react';
import { message, Flex } from 'antd';
import UploadBtn, { FileType } from '@/components/upload-btn';
import Result, { ResultStatus } from '@/components/result';
import type { WorkBook, WorkSheet } from 'xlsx';

type OriginData = Map<string, MachinRoom>;
type HandleData = Map<string, MachinRoom>;

type DiffEquipmentData = (
  h: OriginData,
  o: HandleData,
) => { result: ResultStatus; description: JSX.Element[] };
type AnalyzeWorkBook = (h: HandleData, o: OriginData) => ReturnType<DiffEquipmentData>;
type HandleCheckFile = () => boolean;

// 分光器端口
interface Port {
  name: string;
  next: string;
  nextPort: string;
  belongTo: Splitter;
  line: number;
}

// 分光器
interface Splitter {
  name: string;
  belongTo: MachinRoom;
  ports: Map<string, Port>;
}

// 专业
interface Major {
  name: string;
  splitters: Map<string, Splitter>;
}

// 机房
interface MachinRoom {
  name: string;
  majors: Map<string, Major>;
}

// interface MachinRoom {
//   name: string;
//   splitters: Map<string, Splitter>
//   majors?: Set<string>
// }

const formathandleSheetData = (s: WorkSheet): Map<string, MachinRoom> => {
  const map = new Map<string, MachinRoom>();
  const maxLength = parseInt(s['!ref']?.split(':')?.[1]?.replace?.(/[a-z]/gi, '') ?? '0', 10);

  if (maxLength <= 2) return map;

  for (let i = 2; i <= maxLength; i++) {
    const cell = `A${i}`;
    const roomName = Reflect.get(s, cell)?.v ?? '';

    if (roomName) {
      if (!map.has(roomName)) {
        map.set(roomName, {
          name: roomName,
          majors: new Map<string, Major>(),
        });
      }
      const machinRoom = map.get(roomName)!;
      const majorName = Reflect.get(s, `B${i}`)?.v ?? '';
      const { majors } = machinRoom;

      if (majorName) {
        if (!majors?.has(majorName)) {
          majors.set(majorName, { name: majorName, splitters: new Map() as Major['splitters'] });
        }
      }

      const major = majors.get(majorName)!;
      const { splitters } = major;

      const splitterBox = Reflect.get(s, `J${i}`)?.v?.split('/');
      const splitterName = splitterBox[splitterBox.length - 1]

      if (splitterName) {
        if (!splitters.has(splitterName)) {
          splitters.set(splitterName, {
            name: splitterName,
            belongTo: machinRoom,
            ports: new Map() as Splitter['ports'],
          });
        }
        const splitter = splitters.get(splitterName)!;
        const { ports } = splitter;

        const portName = Reflect.get(s, `K${i}`)?.v ?? '';

        if (portName) {
          if (!ports.has(portName)) {
            const line = i;
            const next = Reflect.get(s, `L${i}`)?.v?.trim() || '';
            const nextPort = Reflect.get(s, `M${i}`)?.v?.trim() || '';
            ports.set(portName, { name: portName, belongTo: splitter, next, nextPort, line });
          }
        }
      }
    }
  }

  return map;
};

const formatOriginSheetData = (s: WorkSheet): Map<string, MachinRoom> => {
  const map = new Map<string, MachinRoom>();
  const maxLength = parseInt(s['!ref']?.split(':')?.[1]?.replace?.(/[a-z]/gi, '') ?? '0', 10);
  if (maxLength <= 2) return map;

  for (let i = 2; i < maxLength; i++) {
    const [roomName, _, splitterName] = (Reflect.get(s, `A${i}`)?.v ?? '').split('/');
    if (!map.has(roomName)) {
      const majors = new Map();
      majors.set('x', { name: 'x', splitters: new Map()});
      map.set(roomName, { name: roomName, majors });
    }
    const machinRoom = map.get(roomName)!;
    const { majors } = machinRoom!;
    const  { splitters }  = majors.get('x')!;

    if (!splitters.has(splitterName)) {
      splitters.set(splitterName, {
        name: splitterName,
        belongTo: machinRoom,
        ports: new Map() as Splitter['ports'],
      });
    }
    const splitter = splitters.get(splitterName)!;
    const { ports } = splitter;

    const portBox = Reflect.get(s, `B${i}`)?.v?.trim()?.split('/');
    const portName = portBox[portBox.length - 1];

    if (!ports.has(portName)) {
      const line = i;
      const next = Reflect.get(s, `C${i}`)?.v?.trim() || '';
      const nextPortBox = Reflect.get(s, `D${i}`)?.v?.trim()?.split('/');
      const nextPort = nextPortBox[nextPortBox.length - 1];
      ports.set(portName, { name: portName, belongTo: splitter, next, nextPort, line });
    }
  }

  return map;
};

const countSplitterPorts = (
  handleSplitters: Map<string, Splitter>,
  originSplitters: Map<string, Splitter>,
) => {
  let [all, right, wrong, error] = [0, 0, 0, [] as string[]];

  for (const [key, handleSplitter] of handleSplitters) {
    all += handleSplitter.ports.size;
    const originSplitter = originSplitters.get(key);
    if (handleSplitter.name !== originSplitter?.name) {
      wrong += handleSplitter.ports.size;
      continue;
    }

    for (const [key, handlePort] of handleSplitter.ports) {
      const originPort = originSplitter.ports.get(key);
      const currentLine = handlePort.line;
      if (handlePort.name !== originPort?.name) {
        wrong++;
        error.push(`第 ${currentLine} 行，端口名称错误`);
        continue;
      }
      if (handlePort.next !== originPort?.next) {
        wrong++;
        error.push(`第 ${currentLine} 行，端口下一跳设备错误`);
        continue;
      }
      right++;
    }
  }

  return {
    all,
    right,
    wrong,
    error,
  };
};

const diffPortData: DiffEquipmentData = (handleData, originData) => {
  let result = ResultStatus.SUCCESS;
  const description = [];

  for (const [key, handleMachineRoom] of handleData) {
    const originMachineRoom = originData.get(key);
    if (!originMachineRoom) {
      description.push(
        <div>
          <b>{handleMachineRoom.name}</b>录入有误！
        </div>,
      );
      break;
    }

    const machiRoomName = handleMachineRoom.name;
    const { majors } = handleMachineRoom;
    for (const [_, handleMajor] of majors) {
      const originMajor = originMachineRoom.majors.get('x')!
      const majorCount = handleMajor.splitters.size;
      const majorName = handleMajor.name
      const { all, right, wrong, error } = countSplitterPorts(
        handleMajor.splitters,
        originMajor.splitters,
      );
      // FIXME: 多个机房时要综合一下
      if (right === all) {
        result = ResultStatus.PERFECT;
      } else if (wrong > right) {
        result = ResultStatus.ERROR;
      } else {
        result = ResultStatus.SUCCESS;
      }

      description.push(
        <div>
          <b>{machiRoomName}</b>{majorName}合计<b>{majorCount}</b>条链路
          <div>
            匹配系统录入数据，其中录入准确<b>{right}</b>个链路，录入有误<b>{wrong}</b>个链路。
          </div>
          {error.length > 0 && error.map((e) => <div>{e}</div>)}
        </div>,
      );
    }
  }

  return {
    description,
    result,
  };
};

/**
 *测试表格-设备端口：
  1、原始表格-链路的sheet是要核对的，导出表就是从系统上导出来和原数据端口进行核对；
  2、“原始表格-链路”的A和B列做一下统计，即：XX机房XX专业XX条链路；
  3、“原数据端口”的J&K列和“导出表”的A&B列是匹配条件，“原数据端口”的L列和M列对应“导出表”的D列是匹配结果；
  4、针对原数据端口表输出报告模板如下：

  descriptipon:
    XXX机房（C列）XX专业合计XX条链路（第二点有描述），匹配系统录入数据，其中录入准确XX个链路（第三点的匹配结果），录入有误XX个链路（第三点的匹配结果）。 
 */
const analyzePortData: AnalyzeWorkBook = (
  handleData: Map<string, MachinRoom>,
  originData: Map<string, MachinRoom>,
) => {
  return diffPortData(handleData, originData);
};

const formatFileData = (type: FileType, workBook: WorkBook) => {
  const [key] = workBook.SheetNames;
  const sheet = workBook.Sheets[key];
  return type === FileType.HANDLE ? formathandleSheetData(sheet) : formatOriginSheetData(sheet);
};

function App() {
  const [handleData, setHandleData] = useState<HandleData | null>(null);
  const [originData, setOriginData] = useState<OriginData | null>(null);
  const [description, setDescription] = useState<JSX.Element[]>([]);
  const [result, setResult] = useState<ResultStatus>(ResultStatus.PERFECT);

  const handleReset = () => {
    setHandleData(null);
    setOriginData(null);
    setDescription([]);
    setResult(ResultStatus.ERROR);
  };

  const handleCheckFile: HandleCheckFile = () => {
    if (!handleData) {
      message.error('请上传“原始台账文件”');
      return false;
    }
    if (!originData) {
      message.error('请上传“资源系统导出文件”');
      return false;
    }

    if (!handleData?.size) {
      message.error('上传的原端口数据表数据异常，请检查');
      console.error('上传了空表');
      return false;
    }

    return true;
  };

  const handleConfirm = () => {
    if (!handleCheckFile()) return;

    const { description, result } = analyzePortData(handleData!, originData!);
    setDescription(description);
    setResult(result);
  };

  const handleFileUpload = (type: FileType, workbook: WorkBook) => {
    const data = formatFileData(type, workbook);
    console.log('🤔 ~ handleFileUpload ~ data:', data)
    if (type === FileType.HANDLE) {
      setHandleData(data);
    } else {
      setOriginData(data);
    }
  };

  return (
    <>
      <Flex gap="middle">
        <UploadBtn
          onUpload={handleFileUpload}
          onReset={handleReset}
          onConfirm={handleConfirm}
          label={[
            { label: '原始台账文件', link: '' },
            { label: '资源系统导出文件', link: '' },
          ]}
        />
        <Result style={{ width: '100%' }} result={result} description={description} />
      </Flex>
    </>
  );
}

export default App;
