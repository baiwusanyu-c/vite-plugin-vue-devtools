import type { ViteInspectAPI } from 'vite-plugin-inspect'
import type { ModuleInfo } from '../../types'
/**
 * 获得组件关系
 * @param rpc
 */
export async function getComponentsRelationships(rpc: ViteInspectAPI['rpc']): Promise<ModuleInfo[]> {
  const list = await rpc.list()
  const modules = list?.modules || []

  return modules
}
