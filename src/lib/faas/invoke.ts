import { FunctionEngine, scheduler } from "."
import { accessor, createDb, db } from '../../lib/db'
import { LocalFileStorage } from "../storage/local_file_storage"
import request from 'axios'
import Config from "../../config"
import { CloudFunctionStruct, CloudSdkInterface, FunctionContext } from "./types"
import { getToken, parseToken } from "../utils/token"
import * as ts from 'typescript'

/**
 * 调用云函数
 */
export async function invokeFunction(func: CloudFunctionStruct, param: FunctionContext) {
  // const { query, body, auth, requestId } = param
  const engine = new FunctionEngine()
  const cloud = createCloudSdk()
  const result = await engine.run(func.compiledCode, {
    context: param,
    functionName: func.name,
    less: cloud,
    cloud: cloud
  })

  return result
}


/**
 * 获取云函数
 * @param func_name 
 * @returns 
 */
export async function getCloudFunction(func_name: string): Promise<CloudFunctionStruct> {
  // 获取函数
  const r = await db.collection('functions')
    .where({ name: func_name })
    .getOne()

  if (!r.ok) {
    throw new Error(`getCloudFunction() failed to get function [${func_name}]: ${r.error.toString()}`)
  }

  return r.data
}

/**
 * 获取云函数 by id
 * @param func_name 
 * @returns 
 */
export async function getCloudFunctionById(func_id: string): Promise<CloudFunctionStruct> {
  // 获取函数
  const r = await db.collection('functions')
    .where({ _id: func_id })
    .getOne()

  if (!r.ok) {
    throw new Error(`getCloudFunctionById() failed to get function [${func_id}]: ${r.error.toString()}`)
  }

  return r.data
}



// 跨请求、跨函数的全局配置对象，单例（in memory）
const _shared_preference = new Map<string, any>()

/**
 * 创建云函数 cloud sdk
 * @returns 
 */
function createCloudSdk(): CloudSdkInterface {

  const cloud: CloudSdkInterface = {
    database: () => createDb(),
    storage: (namespace: string) => new LocalFileStorage(Config.LOCAL_STORAGE_ROOT_PATH, namespace),
    fetch: request,
    invoke: _invokeInFunction,
    emit: (event: string, param: any) => scheduler.emit(event, param),
    shared: _shared_preference,
    getToken: getToken,
    parseToken: parseToken,
    mongodb: accessor.db
  }

  return cloud
}

/**
 * 在云函数中[调用云函数]的函数
 */
async function _invokeInFunction(name: string, param: FunctionContext) {
  const func = await getCloudFunction(name)
  if (!func) {
    throw new Error(`invoke() failed to get function: ${name}`)
  }

  if (param?.method) {
    param.method = param.method ?? 'call'
  }
  const result = await invokeFunction(func, param ?? { method: 'call' })

  // 将云函数调用日志存储到数据库
  {
    result.logs.unshift(`invoked in function: ${func.name} (${func._id})`)
    await db.collection('function_logs')
      .add({
        requestId: `func_${func._id}`,
        func_id: func._id,
        func_name: func.name,
        logs: result.logs,
        time_usage: result.time_usage,
        created_at: Date.now(),
        updated_at: Date.now(),
        created_by: `${func._id}`
      })
  }

  return result
}

/**
 * 编译云函数(TS) 到 JS
 * @param {string} source ts 代码字符串
 */
 export function compileTsFunction2js(source: string): string {
  const jscode = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2017
  })
  return jscode
}