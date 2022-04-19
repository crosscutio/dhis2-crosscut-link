import ky from 'ky'
import { options, getBaseURL } from "./apiConfig"
import { getCatchmentGeoJSON } from "./crosscutRequests"

const baseURL = getBaseURL()

export const fetchOrgUnitLevels = async () => {
    const orgUnits = await ky.get(`${baseURL}/organisationUnits.json?fields=id,displayName~rename(name)&paging=false`, options).json()

    const resp = await ky.get(`${baseURL}/organisationUnitLevels.json?fields=id,displayName~rename(name),level&paging=false&order=level:asc`, options).json()
    return resp.organisationUnitLevels
}

export const fetchOrgUnitGroups = async () => {
    const resp = await ky.get(`${baseURL}/organisationUnitGroups.json?fields=id,displayName~rename(name)&paging=false`, options).json()
    return resp.organisationUnitGroups
}

export const fetchACatchmentInUse = async (id) => {
    // id is the attribute id
    const resp = await ky.get(`${baseURL}/maps.json?filter=mapViews.orgUnitField:eq:${id}`, options).json()
    return resp.maps
}

export const fetchCurrentAttributes = async () => {
    const resp = await ky.get(`${baseURL}/attributes.json?fields=id,name&filter=valueType:eq:GEOJSON&filter=organisationUnitAttribute:eq:true&paging=false`, options).json()
    return resp.attributes
}

export const fetchGeoJSON = async (levelId, groupId) => {
    let groupLink = []
    if (groupId.length > 1) {   
        groupId.forEach((id) => groupLink.push(`%3BOU_GROUP-${id}`))
    } else {
        groupLink = groupId
    }

    const resp = await ky(`${baseURL}/geoFeatures?ou=ou%3ALEVEL-${levelId}%3BOU_GROUP-${groupLink}&displayProperty=NAME`, options).json()

    const features = resp.map((feature) => {
        const coord = JSON.parse(feature.co)
        let type = "Point" 

        if (feature.ty === 2) {
            type = "Polygon"
        }

        return {
            type: "Feature",
            id: feature.id,
            geometry: {
                type,
                coordinates: coord
            },
            properties: {
                id: feature.id,
                name: feature.na,
                level: feature.le,
                parentName: feature.pn,
                parentId: feature.pi
            }
        }
    })
    const geojson = {
        type: "FeatureCollection",
        features
    }

    return geojson
}

export const fetchValidPoints = async (levelId, groupId) => {
    let groupLink = []
    if (groupId.length > 1) {   
        groupId.forEach((id) => groupLink.push(`%3BOU_GROUP-${id}`))
    } else {
        groupLink = groupId
    }

    let resp = await ky(`${baseURL}/geoFeatures?ou=ou%3ALEVEL-${levelId}%3BOU_GROUP-${groupLink}&displayProperty=NAME`, options).json()

    resp = resp.filter((feature) => feature.ty === 1)

    const features = resp.map((feature) => {
        const coord = JSON.parse(feature.co)
        const lat = coord[1]
        const long = coord[0]
        return {
            id: feature.id,
            lat,
            long,
            id: feature.id,
            name: feature.na,
            level: feature.le,
            parentName: feature.pn,
            parentId: feature.pi,
            code: feature.code
        }
    })
    return features
}

export const publishCatchment = async (body) => {
    const features = await getCatchmentGeoJSON(body.id)
    console.log(features)

    const orgUnits = await ky.get(`${baseURL}/organisationUnits.json?fields=id,displayName~rename(name)&paging=false`, options).json()
    console.log(orgUnits)

    // this endpoint posts an attribute and returns uid
    const resp = await ky.post(`${baseURL}/attributes`, { body: JSON.stringify(body.payload), headers: options }).json()
    console.log(resp)
    // use this id to store with the catchment areas
    const attributeId = resp?.response?.uid

    options["Content-Type"] = "application/json-patch+json"
    let found = []
    for (let i=0; i<orgUnits.organisationUnits.length; i++) {
        const name = orgUnits.organisationUnits[i].name
        const exists = features.find((feat) => feat.properties["cc:Name"] === name)
        if (exists !== undefined) {
            found.push({ id: orgUnits.organisationUnits[i].id, geojson: exists.geometry})
    //         const geojson = JSON.stringify(exists.geometry)
    //         const orgId = orgUnits.organisationUnits[i].id

    //         // handle adding geojson to each org unit
    //         const res = await ky
    //               .patch(`${baseURL}/organisationUnits/${orgId}`, {
    //                 headers: options,
    //                 body: JSON.stringify([{
    //                   op: "add",
    //                   path: "/attributeValues/-",
    //                   value: {
    //                     value: geojson,
    //                     attribute: {
    //                       id: attributeId,
    //                     },
    //                   },
    //                 }]),
    //               })
    //               .json();
                //   console.log(res)
        }
    }

            // options["Content-Type"] = "application/json-patch+json"

            // handle adding geojson to each org unit
            const res = await ky
                  .patch(`${baseURL}/organisationUnits/${found[0].id}`, {
                    headers: options,
                    body: JSON.stringify([{
                      op: "add",
                      path: "/attributeValues/-",
                      value: {
                        value: JSON.stringify(found[0].geojson),
                        attribute: {
                          id: attributeId,
                        },
                      },
                    }]),
                  })
                  .json();
                  console.log(res)

    // const ugh = await ky(`${baseURL}/organisationUnits.json?filter=level:eq:4&paging=false&fields=id,name,level,coordinates`, options).json()
    // console.log(ugh.organisationUnits)

    // this endpoint gets all attributes
    // const attributes = await ky(`${baseURL}/attributes`, options).json()
    // console.log(attributes)

}

export const unPublishCatchment = async (body) => {

    // remove coordinates from each org unit and attribute

    const features = await getCatchmentGeoJSON(body.id)
    console.log(features)

    const orgUnits = await ky.get(`${baseURL}/organisationUnits.json?fields=id,displayName~rename(name)&paging=false`, options).json()
    console.log(orgUnits)


    let found = []
    for (let i=0; i<orgUnits.organisationUnits.length; i++) {
        const name = orgUnits.organisationUnits[i].name
        const exists = features.find((feat) => feat.properties["cc:Name"] === name)
        if (exists !== undefined) {
            found.push({ id: orgUnits.organisationUnits[i].id, geojson: exists.geometry})
        }
    }

    const resp = await ky(`${baseURL}/organisationUnits/NrxMLPbranA?fields=%3Aall%2CattributeValues%5B%3Aall%2Cattribute%5Bid%2Cname%2CdisplayName%5D%5D`, options).json()
    console.log(resp)

    const filtered = resp.attributeValues.filter((value) => value.attribute.name !== body.name)


    const payload = {
        attributeValues: filtered,
        code: resp.code,
        created: resp.created,
        createdBy: resp.createdBy,
        id: resp.id,
        lastUpdated:  resp.lastUpdated,
        lastUpdatedBy: resp.lastUpdatedBy,
        level: resp.level,
        name: resp.name,
        openingDate: resp.openingDate,
        parent: resp.parent,
        path: resp.path,
        shortName: resp.shortName,
    }

    // delete coordinates from each org unit
    const res = await ky.put(`${baseURL}/organisationUnits/NrxMLPbranA?mergeMode=REPLACE`, {
        headers: options,
        body: JSON.stringify(payload),
        }).json();
        console.log(res)

    // delete attribute
    await ky.delete(`${baseURL}/attributes/${body.attributeId}`, options).json()
}